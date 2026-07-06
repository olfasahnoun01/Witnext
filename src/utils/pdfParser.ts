import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { ParsedDevisDocument, ParsedDevisHeader, ParsedDevisLine } from './pdfDevisTypes';
import {
  extractEmail,
  extractMatriculeFiscale,
  extractPhoneNumber,
} from './pdfSupplierFields';
import {
  extractLinesFromSpatialRows,
  extractSupplierHeaderFromItems,
  groupItemsIntoRows,
  type PdfTextItem,
} from './pdfDevisSpatialParser';

export type { ParsedDevisDocument, ParsedDevisHeader, ParsedDevisLine } from './pdfDevisTypes';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const HEADER_NOISE =
  /^(TOTAL|HT|TTC|DATE|DEVIS|FACTURE|QUANT|PRIX|PAGE|CLIENT|FOURNISSEUR|MATRICULE|TVA|BON\s+DE\s+COMMANDE)/i;

function parseDecimal(raw: string): number {
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTvaRate(value: number): number {
  const rounded = Math.round(value);
  if ([0, 7, 13, 19].includes(rounded)) return rounded;
  if (value > 0 && value <= 19) return rounded;
  return 19;
}

function parseLineFromText(lineText: string): ParsedDevisLine | null {
  const trimmed = lineText.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.length < 8 || HEADER_NOISE.test(trimmed)) return null;

  const indexed = trimmed.match(
    /^(\d+)\s+(.+?)\s+(\d+(?:[.,]\d{2,4})?)\s+(\d+(?:[.,]\d{2,4})?)\s+(\d+(?:[.,]\d{2,4})?)(?:\s+\d+(?:[.,]\d{2,4})?)?$/
  );
  if (indexed?.[2]) {
    return {
      designation: indexed[2].trim(),
      quantity: parseDecimal(indexed[3]),
      unitPrice: parseDecimal(indexed[4]),
      tvaRate: normalizeTvaRate(parseDecimal(indexed[5])),
    };
  }

  const alt = trimmed.match(
    /^([A-Za-zÀ-ÿ].+?)\s+(\d+(?:[.,]\d{2,4})?)\s+(\d+(?:[.,]\d{2,4})?)\s+(\d+(?:[.,]\d{2,4})?)(?:\s+\d+(?:[.,]\d{2,4})?)?$/
  );
  if (alt?.[1]) {
    return {
      designation: alt[1].trim(),
      quantity: parseDecimal(alt[2]),
      unitPrice: parseDecimal(alt[3]),
      tvaRate: normalizeTvaRate(parseDecimal(alt[4])),
    };
  }

  return null;
}

function buildLinesFromPdfItems(textItems: { str: string; transform: number[] }[]): string[] {
  const yMap = new Map<number, { text: string; x: number }[]>();

  textItems.forEach((t) => {
    const text = t.str.trim();
    if (!text) return;

    let y = t.transform[5];
    const x = t.transform[4];
    const foundY = Array.from(yMap.keys()).find((key) => Math.abs(key - y) <= 4);
    if (foundY) y = foundY;

    if (!yMap.has(y)) yMap.set(y, []);
    yMap.get(y)!.push({ text: t.str, x });
  });

  return Array.from(yMap.keys())
    .sort((a, b) => b - a)
    .map((y) => {
      const lineParts = yMap.get(y)!.sort((a, b) => a.x - b.x);
      return lineParts.map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim();
    });
}

export function parseDevisLinesFromPlainLines(lineTexts: string[]): ParsedDevisLine[] {
  const lines: ParsedDevisLine[] = [];
  const seen = new Set<string>();

  for (const lineText of lineTexts) {
    const parsed = parseLineFromText(lineText);
    if (!parsed || parsed.designation.length < 3) continue;
    const key = parsed.designation.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(parsed);
  }

  return lines;
}

function parseFrenchDateToIso(raw: string): string | undefined {
  const m = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return undefined;
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  const month = m[2].padStart(2, '0');
  const day = m[1].padStart(2, '0');
  const iso = `${year}-${month}-${day}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return iso;
}

/** Used by OCR image import — shares MF / phone rules with PDF spatial parser. */
export function parseDevisHeaderFromText(fullText: string): ParsedDevisHeader {
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2 && l.length <= 140);

  const header: ParsedDevisHeader = {
    taxId: extractMatriculeFiscale(lines, fullText),
    phone: extractPhoneNumber(lines, fullText),
    email: extractEmail(lines, fullText),
  };

  const dateMatch = fullText.match(
    /(?:date|le)\s*:?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i
  );
  const dateRaw = dateMatch?.[1] ?? fullText.match(/\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})\b/)?.[1];
  if (dateRaw) header.documentDate = parseFrenchDateToIso(dateRaw);

  const numberMatch = fullText.match(
    /(?:devis|facture|offre|bon\s+de\s+commande|n[°o])\s*:?\s*([A-Z0-9][A-Z0-9\-\/_.]{2,})/i
  );
  if (numberMatch) header.documentNumber = numberMatch[1].trim();

  for (const line of lines.slice(0, 25)) {
    if (HEADER_NOISE.test(line)) continue;
    if (/\d{6,7}\/[A-Za-z]/.test(line)) continue;
    if (/^\d{1,2}[\/\-.]\d{1,2}/.test(line)) continue;
    if (/^[A-ZÀ-Ÿ0-9][A-ZÀ-Ÿ0-9\s&.'\-]{4,}$/.test(line)) {
      header.supplierName = line;
      break;
    }
  }

  return header;
}

async function extractPdfTextItems(file: File): Promise<{
  items: PdfTextItem[];
  fullText: string;
  pageHeight: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allItems: PdfTextItem[] = [];
  const textChunks: string[] = [];
  let pageHeight = 842;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    if (i === 1) pageHeight = viewport.height;

    const textContent = await page.getTextContent();
    const rawItems = textContent.items as {
      str: string;
      transform: number[];
      width?: number;
      height?: number;
    }[];

    for (const t of rawItems) {
      const str = t.str?.trim();
      if (!str) continue;
      allItems.push({
        str: t.str,
        x: t.transform[4],
        y: t.transform[5],
        width: t.width ?? Math.max(str.length * 4, 8),
        height: t.height ?? 10,
        page: i,
      });
    }

    textChunks.push(rawItems.map((t) => t.str).join(' '));
  }

  return { items: allItems, fullText: textChunks.join('\n'), pageHeight };
}

export async function extractDevisDocumentFromPdf(file: File): Promise<ParsedDevisDocument> {
  const { items, fullText, pageHeight } = await extractPdfTextItems(file);
  const rows = groupItemsIntoRows(items);

  let lines = extractLinesFromSpatialRows(rows);

  if (lines.length === 0) {
    const plainLines = rows.map((row) =>
      row.items
        .map((i) => i.str.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
    lines = parseDevisLinesFromPlainLines(plainLines);
  }

  const header = extractSupplierHeaderFromItems(items, pageHeight, fullText);

  return { lines, header, fullText };
}

/** @deprecated Prefer extractDevisDocumentFromPdf — kept for DevisHelper compatibility. */
export const extractDevisItemsFromPdf = async (file: File): Promise<string[]> => {
  const doc = await extractDevisDocumentFromPdf(file);
  return doc.lines.map((l) => l.designation);
};
