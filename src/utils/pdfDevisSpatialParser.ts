/**
 * Spatial PDF table extraction for supplier devis / BC documents.
 * Uses text item (x, y) positions from pdf.js — works for native PDF text layers.
 */

import type { ParsedDevisHeader, ParsedDevisLine } from './pdfDevisTypes';
import {
  extractEmail,
  extractMatriculeFiscale,
  extractPhoneNumber,
  isBankingLine,
} from './pdfSupplierFields';

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface SpatialRow {
  y: number;
  page: number;
  items: PdfTextItem[];
}

type ColumnKind = 'index' | 'designation' | 'quantity' | 'unitPrice' | 'tva' | 'amount' | 'unknown';

interface ColumnDef {
  kind: ColumnKind;
  xMin: number;
  xMax: number;
}

const ROW_Y_TOLERANCE = 5;
const FOOTER_ROW =
  /^(total|sous[- ]?total|montant\s+ht|net\s+[àa]\s+payer|tva\s+collect|remise|escompte|arrêt[ée]|arrête)/i;
const HEADER_NOISE =
  /^(TOTAL|HT|TTC|DATE|DEVIS|FACTURE|QUANT|PRIX|PAGE|CLIENT|FOURNISSEUR|MATRICULE|TVA|BON\s+DE\s+COMMANDE|RIB|IBAN|BANQUE)/i;
const MF_VALUE = /\b\d{6,7}\/[A-Za-z]\/[A-Za-z]\/[A-Za-z]\/\d{3}\b/i;
const PHONE_LABEL_LINE =
  /(?:tél|tel|téléphone|telephone|gsm|mobile|portable|fax)\s*:?\s*/i;
const NUMERIC_TOKEN = /^-?\d+(?:[.,\s]\d{3})*(?:[.,]\d+)?%?$/;

function parseDecimal(raw: string): number {
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/%$/, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTvaRate(value: number): number {
  const rounded = Math.round(value);
  if ([0, 7, 13, 19].includes(rounded)) return rounded;
  if (value > 0 && value <= 19) return rounded;
  return 19;
}

function itemCenterX(item: PdfTextItem): number {
  return item.x + item.width / 2;
}

function classifyHeaderCell(text: string): ColumnKind {
  const t = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (/design|article|libell|ref|description|produit|intitule/.test(t)) return 'designation';
  if (/^n[°o]?$|^#$/.test(t.trim())) return 'index';
  if (/\b(qt|qte|quant|q\.)\b/.test(t)) return 'quantity';
  if (/p\.?\s*u|prix\s*unit|unitaire|pu\s*ht|prix\s*ht/.test(t)) return 'unitPrice';
  if (/\btva\b|taux/.test(t)) return 'tva';
  if (/montant|total\s*ht|\bmont\b/.test(t)) return 'amount';
  return 'unknown';
}

export function groupItemsIntoRows(items: PdfTextItem[], yTolerance = ROW_Y_TOLERANCE): SpatialRow[] {
  const rows: SpatialRow[] = [];

  for (const item of items) {
    const text = item.str.trim();
    if (!text) continue;

    const found = rows.find(
      (row) => row.page === item.page && Math.abs(row.y - item.y) <= yTolerance
    );

    if (found) {
      found.items.push(item);
      found.y = (found.y * (found.items.length - 1) + item.y) / found.items.length;
    } else {
      rows.push({ y: item.y, page: item.page, items: [item] });
    }
  }

  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
  }

  return rows.sort((a, b) => b.y - a.y || a.page - b.page);
}

function rowText(row: SpatialRow): string {
  return row.items
    .map((i) => i.str.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHeaderRow(row: SpatialRow): boolean {
  const text = rowText(row).toLowerCase();
  const hasDesignation = /désign|design|article|libell|description|réf|ref/.test(text);
  const hasQtyOrPrice = /qt|quant|qte|p\.?\s*u|prix|unitaire|montant/.test(text);
  return hasDesignation && hasQtyOrPrice;
}

function isFooterRow(row: SpatialRow): boolean {
  const text = rowText(row);
  if (!text) return false;
  if (FOOTER_ROW.test(text)) return true;
  if (/^tva\b/i.test(text) && !row.items.some((i) => i.str.length > 20)) return true;
  return false;
}

function buildColumnsFromHeaderRow(row: SpatialRow): ColumnDef[] {
  const cells = row.items.map((item) => ({
    item,
    kind: classifyHeaderCell(item.str),
    cx: itemCenterX(item),
  }));

  const columns: ColumnDef[] = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const kind = cell.kind === 'unknown' && i === 0 ? 'index' : cell.kind;
    const prev = columns[columns.length - 1];
    const xMin = prev ? (prev.xMax + cell.cx) / 2 : 0;
    const next = cells[i + 1];
    const xMax = next ? (cell.cx + next.cx) / 2 : cell.cx + 200;
    columns.push({ kind, xMin, xMax });
  }

  if (!columns.some((c) => c.kind === 'designation')) {
    const firstNumericIdx = cells.findIndex((c) => NUMERIC_TOKEN.test(c.item.str.replace(/\s/g, '')));
    if (firstNumericIdx > 0) {
      const splitX = cells[firstNumericIdx].cx - 10;
      return [
        { kind: 'designation', xMin: 0, xMax: splitX },
        ...cells.slice(firstNumericIdx).map((cell, idx, arr) => {
          const next = arr[idx + 1];
          return {
            kind: classifyHeaderCell(cell.item.str) === 'unknown' ? 'amount' : classifyHeaderCell(cell.item.str),
            xMin: idx === 0 ? splitX : (itemCenterX(arr[idx - 1].item) + cell.cx) / 2,
            xMax: next ? (cell.cx + itemCenterX(next.item)) / 2 : cell.cx + 120,
          };
        }),
      ];
    }
  }

  return columns;
}

function inferColumnsFromNumericRows(rows: SpatialRow[]): ColumnDef[] {
  const numericXs: number[] = [];
  for (const row of rows) {
    for (const item of row.items) {
      const compact = item.str.replace(/\s/g, '');
      if (NUMERIC_TOKEN.test(compact) && parseDecimal(compact) > 0) {
        numericXs.push(itemCenterX(item));
      }
    }
  }
  if (numericXs.length < 3) return [];

  numericXs.sort((a, b) => a - b);
  const clusters: number[] = [];
  for (const x of numericXs) {
    const last = clusters[clusters.length - 1];
    if (last == null || Math.abs(x - last) > 25) clusters.push(x);
    else clusters[clusters.length - 1] = (last + x) / 2;
  }

  const numericClusters = clusters.slice(-4);
  const splitX = numericClusters[0] - 15;
  const cols: ColumnDef[] = [{ kind: 'designation', xMin: 0, xMax: splitX }];

  const kinds: ColumnKind[] =
    numericClusters.length >= 4
      ? ['quantity', 'unitPrice', 'tva', 'amount']
      : numericClusters.length === 3
        ? ['quantity', 'unitPrice', 'amount']
        : ['quantity', 'unitPrice'];

  numericClusters.forEach((cx, idx) => {
    const prev = numericClusters[idx - 1];
    const next = numericClusters[idx + 1];
    cols.push({
      kind: kinds[idx] ?? 'amount',
      xMin: prev ? (prev + cx) / 2 : splitX,
      xMax: next ? (cx + next) / 2 : cx + 80,
    });
  });

  return cols;
}

function cellTextForColumn(row: SpatialRow, col: ColumnDef): string {
  return row.items
    .filter((item) => {
      const cx = itemCenterX(item);
      return cx >= col.xMin && cx < col.xMax;
    })
    .map((i) => i.str.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function parseRowWithColumns(row: SpatialRow, columns: ColumnDef[]): ParsedDevisLine | null {
  const designationCol = columns.find((c) => c.kind === 'designation');
  const qtyCol = columns.find((c) => c.kind === 'quantity');
  const priceCol = columns.find((c) => c.kind === 'unitPrice');
  const tvaCol = columns.find((c) => c.kind === 'tva');

  let designation = designationCol ? cellTextForColumn(row, designationCol) : '';
  if (!designation) {
    const indexCol = columns.find((c) => c.kind === 'index');
    designation = row.items
      .filter((item) => {
        const cx = itemCenterX(item);
        const inIndex = indexCol && cx >= indexCol.xMin && cx < indexCol.xMax;
        const inKnown =
          columns.some((c) => c.kind !== 'designation' && c.kind !== 'unknown' && cx >= c.xMin && cx < c.xMax);
        return !inIndex && !inKnown;
      })
      .map((i) => i.str.trim())
      .join(' ')
      .trim();
  }

  designation = designation.replace(/^\d+[\s.)-]+/, '').trim();
  if (!designation || designation.length < 2 || HEADER_NOISE.test(designation) || FOOTER_ROW.test(designation)) {
    return null;
  }

  const qtyText = qtyCol ? cellTextForColumn(row, qtyCol) : '';
  const priceText = priceCol ? cellTextForColumn(row, priceCol) : '';
  const tvaText = tvaCol ? cellTextForColumn(row, tvaCol) : '';

  let quantity = parseDecimal(qtyText);
  let unitPrice = parseDecimal(priceText);
  let tvaRate = tvaText ? normalizeTvaRate(parseDecimal(tvaText)) : 19;

  const numericParts = row.items
    .map((i) => i.str.trim())
    .filter((s) => NUMERIC_TOKEN.test(s.replace(/\s/g, '')))
    .map((s) => parseDecimal(s));

  if (quantity <= 0 && numericParts.length >= 2) quantity = numericParts[0];
  if (unitPrice <= 0 && numericParts.length >= 2) {
    unitPrice = numericParts.length >= 3 ? numericParts[1] : numericParts[numericParts.length - 2];
  }
  if (!tvaText && numericParts.length >= 3) {
    const maybeTva = numericParts.find((n) => [0, 7, 13, 19].includes(Math.round(n)));
    if (maybeTva != null) tvaRate = normalizeTvaRate(maybeTva);
  }

  if (quantity <= 0 && unitPrice <= 0) return null;
  if (quantity <= 0) quantity = 1;

  return { designation, quantity, unitPrice, tvaRate };
}

function parseLineFromJoinedText(lineText: string): ParsedDevisLine | null {
  const trimmed = lineText.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.length < 6 || HEADER_NOISE.test(trimmed) || FOOTER_ROW.test(trimmed)) return null;

  const indexed = trimmed.match(
    /^(\d+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)(?:\s+\d+(?:[.,]\d+)?)?$/
  );
  if (indexed?.[2]) {
    return {
      designation: indexed[2].trim(),
      quantity: parseDecimal(indexed[3]),
      unitPrice: parseDecimal(indexed[4]),
      tvaRate: normalizeTvaRate(parseDecimal(indexed[5])),
    };
  }

  const numbers = [...trimmed.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) => parseDecimal(m[1]));
  if (numbers.length >= 2) {
    const designation = trimmed
      .replace(/\s+\d+(?:[.,]\d+)?(?:\s+\d+(?:[.,]\d+)?)*\s*$/, '')
      .replace(/^\d+[\s.)-]+/, '')
      .trim();
    if (designation.length >= 3) {
      const qty = numbers.length >= 3 ? numbers[0] : numbers[0];
      const price = numbers.length >= 3 ? numbers[1] : numbers[numbers.length - 1];
      const tvaCandidate = numbers.find((n) => [0, 7, 13, 19].includes(Math.round(n)));
      return {
        designation,
        quantity: qty > 0 ? qty : 1,
        unitPrice: price,
        tvaRate: tvaCandidate != null ? normalizeTvaRate(tvaCandidate) : 19,
      };
    }
  }

  return null;
}

export function extractLinesFromSpatialRows(rows: SpatialRow[]): ParsedDevisLine[] {
  if (rows.length === 0) return [];

  let headerIdx = rows.findIndex(isHeaderRow);
  let columns: ColumnDef[] = [];

  if (headerIdx >= 0) {
    columns = buildColumnsFromHeaderRow(rows[headerIdx]);
  }

  const bodyStart = headerIdx >= 0 ? headerIdx + 1 : 0;
  let bodyRows = rows.slice(bodyStart);

  const footerIdx = bodyRows.findIndex(isFooterRow);
  if (footerIdx >= 0) bodyRows = bodyRows.slice(0, footerIdx);

  if (columns.length === 0) {
    columns = inferColumnsFromNumericRows(bodyRows.slice(0, 15));
  }

  const lines: ParsedDevisLine[] = [];
  const seen = new Set<string>();

  if (columns.length > 0) {
    for (const row of bodyRows) {
      const parsed = parseRowWithColumns(row, columns);
      if (!parsed) continue;
      const key = `${parsed.designation.toLowerCase()}|${parsed.quantity}|${parsed.unitPrice}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(parsed);
    }
  }

  if (lines.length === 0) {
    for (const row of bodyRows) {
      const parsed = parseLineFromJoinedText(rowText(row));
      if (!parsed) continue;
      const key = parsed.designation.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(parsed);
    }
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

export function extractSupplierHeaderFromItems(
  items: PdfTextItem[],
  pageHeight: number,
  fullText: string
): ParsedDevisHeader {
  const header: ParsedDevisHeader = {};

  const topItems = items.filter((i) => i.page === 1 && i.y >= pageHeight * 0.55);
  const topRows = groupItemsIntoRows(topItems, 6);
  const topLines = topRows.map(rowText).filter((l) => l.length >= 2 && l.length <= 140);

  const allRows = groupItemsIntoRows(items, 6);
  const allLines = allRows.map(rowText).filter((l) => l.length >= 2 && l.length <= 140);

  header.taxId = extractMatriculeFiscale(allLines, fullText);
  header.phone = extractPhoneNumber(allLines, fullText);
  header.email = extractEmail(allLines, fullText);

  const dateMatch = fullText.match(
    /(?:date|le)\s*:?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i
  );
  const dateRaw =
    dateMatch?.[1] ?? fullText.match(/\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})\b/)?.[1];
  if (dateRaw) header.documentDate = parseFrenchDateToIso(dateRaw);

  const numberMatch = fullText.match(
    /(?:devis|facture|offre|bon\s+de\s+commande|n[°o])\s*:?\s*([A-Z0-9][A-Z0-9\-\/_.]{2,})/i
  );
  if (numberMatch) header.documentNumber = numberMatch[1].trim();

  for (const line of topLines) {
    if (HEADER_NOISE.test(line)) continue;
    if (MF_VALUE.test(line)) continue;
    if (isBankingLine(line)) continue;
    if (/^\d{1,2}[\/\-.]\d{1,2}/.test(line)) continue;
    if (/^(tel|tél|phone|email|mf|matricule|adresse|rib|iban|fax|gsm)/i.test(line)) continue;

    if (/\b(sarl|sa|suarl|eurl|gmbh|ltd|ste|société|societe)\b/i.test(line) || /^[A-ZÀ-Ÿ]/.test(line)) {
      header.supplierName = line.replace(/^(fournisseur|supplier|vendeur)\s*:?\s*/i, '').trim();
      break;
    }
  }

  if (!header.supplierName) {
    for (const line of topLines) {
      if (HEADER_NOISE.test(line) || MF_VALUE.test(line) || isBankingLine(line)) continue;
      if (/^[A-ZÀ-Ÿ0-9][A-Za-zÀ-ÿ0-9\s&.'\-]{4,}$/.test(line)) {
        header.supplierName = line;
        break;
      }
    }
  }

  const addressLines = topLines.filter(
    (l) =>
      l.length >= 8 &&
      !HEADER_NOISE.test(l) &&
      !MF_VALUE.test(l) &&
      !isBankingLine(l) &&
      l !== header.supplierName &&
      !PHONE_LABEL_LINE.test(l) &&
      /(\d{4,5}|rue|avenue|av\.|route|zone|charguia|tunis|sfax|sousse|bizerte|gabès|gabes)/i.test(l)
  );
  if (addressLines.length > 0) {
    header.address = addressLines.slice(0, 2).join(', ');
  }

  return header;
}
