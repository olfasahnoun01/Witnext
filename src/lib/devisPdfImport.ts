import { supabase } from '@/integrations/supabase/client';
import type { DevisItem } from '@/types';
import type { ParsedDevisDocument, ParsedDevisLine } from '@/utils/pdfParser';
import { extractDevisDocumentFromPdf } from '@/utils/pdfParser';
import { extractDevisDocumentFromImage } from '@/utils/ocrParser';

export interface FournisseurRef {
  id: number;
  nom: string;
  matricule_fiscale?: string | null;
  location?: string | null;
  phone?: string | null;
}

export interface ImportedBcLine extends ParsedDevisLine {
  product_id?: number;
  sku?: string;
  matched: boolean;
}

export interface BcFournisseurPdfImportResult {
  items: DevisItem[];
  lines: ImportedBcLine[];
  header: ParsedDevisDocument['header'];
  supplier: FournisseurRef | null;
  sourceFile: File;
}

async function matchProductsForLines(lines: ParsedDevisLine[]): Promise<ImportedBcLine[]> {
  if (lines.length === 0) return [];

  const designations = lines.map((l) => l.designation);
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku')
    .in('name', designations);

  const productByName = new Map((products ?? []).map((p) => [p.name, p]));

  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, sku')
    .limit(800);

  const catalog = allProducts ?? [];

  return lines.map((line) => {
    const exact = productByName.get(line.designation);
    if (exact) {
      return {
        ...line,
        product_id: exact.id,
        sku: exact.sku ?? undefined,
        matched: true,
      };
    }

    const needle = line.designation.toLowerCase();
    const fuzzy = catalog.find(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        needle.includes(p.name.toLowerCase())
    );
    if (fuzzy) {
      return {
        ...line,
        product_id: fuzzy.id,
        sku: fuzzy.sku ?? undefined,
        matched: true,
      };
    }

    return { ...line, matched: false };
  });
}

export function detectSupplierFromDocument(
  doc: ParsedDevisDocument,
  fournisseurs: FournisseurRef[]
): FournisseurRef | null {
  const { header, fullText } = doc;

  if (header.taxId) {
    const byTax = fournisseurs.find(
      (f) => f.matricule_fiscale?.toUpperCase() === header.taxId!.toUpperCase()
    );
    if (byTax) return byTax;
  }

  for (const f of fournisseurs) {
    const nom = f.nom.trim();
    if (nom.length >= 4 && fullText.toLowerCase().includes(nom.toLowerCase())) {
      return f;
    }
  }

  if (header.supplierName) {
    const byName = fournisseurs.find(
      (f) => f.nom.trim().toLowerCase() === header.supplierName!.trim().toLowerCase()
    );
    if (byName) return byName;
  }

  return null;
}

export function buildDevisItemsFromImport(
  lines: ImportedBcLine[],
  fournisseurName: string
): DevisItem[] {
  return lines.map((line) => ({
    line_id: Math.random().toString(36).substring(7),
    designation: line.designation,
    fournisseur: fournisseurName,
    prix_ttc: line.unitPrice,
    remise: 0,
    quantity: line.quantity > 0 ? line.quantity : 1,
    tva: line.tvaRate,
    ...(line.product_id ? { product_id: line.product_id } : {}),
    ...(line.sku ? { sku: line.sku } : {}),
  }));
}

export async function importBcFournisseurFromFile(
  file: File,
  fournisseurs: FournisseurRef[],
  onOcrProgress?: (progress: number) => void
): Promise<BcFournisseurPdfImportResult> {
  const isPdf = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    throw new Error('Format non supporté');
  }

  const doc = isPdf
    ? await extractDevisDocumentFromPdf(file)
    : await extractDevisDocumentFromImage(file, onOcrProgress);

  if (doc.lines.length === 0) {
    throw new Error('Aucune ligne article détectée dans le document');
  }

  const lines = await matchProductsForLines(doc.lines);
  const supplier = detectSupplierFromDocument(doc, fournisseurs);
  const fournisseurName = supplier?.nom ?? doc.header.supplierName ?? '';

  return {
    items: buildDevisItemsFromImport(lines, fournisseurName),
    lines,
    header: doc.header,
    supplier,
    sourceFile: file,
  };
}
