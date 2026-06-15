import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { exportExcelTable } from '@/lib/exportExcel';

export const SUIVI_PARTIES_HEADERS = [
  'Date devis',
  'N° Devis',
  'Société',
  'Téléphone',
  'Réponse',
  'Date dernier contact',
] as const;

export interface SuiviPartiesExportRow {
  devis_date: string | null;
  devis_number: string | null;
  societe: string;
  telephone: string | null;
  reponse: string | null;
  dernier_contact_date: string | null;
}

function formatExportDate(value: string | null): string {
  if (!value) return '';
  try {
    return format(new Date(value), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return value;
  }
}

export function suiviPartiesToExportRows(rows: SuiviPartiesExportRow[]): string[][] {
  return rows.map((row) => [
    formatExportDate(row.devis_date),
    row.devis_number ?? '',
    row.societe,
    row.telephone ?? '',
    row.reponse ?? '',
    formatExportDate(row.dernier_contact_date),
  ]);
}

function exportBaseName(type: 'client' | 'fournisseur'): string {
  const label = type === 'client' ? 'suivi-clients' : 'suivi-fournisseurs';
  return `${label}-${new Date().toISOString().slice(0, 10)}`;
}

export async function exportSuiviPartiesExcel(
  type: 'client' | 'fournisseur',
  rows: SuiviPartiesExportRow[]
): Promise<void> {
  const sheetName = type === 'client' ? 'Suivi clients' : 'Suivi fournisseurs';
  await exportExcelTable({
    filename: `${exportBaseName(type)}.xlsx`,
    sheetName,
    headerColor: type === 'client' ? 'FFBE123C' : 'FF1E3A5F',
    headers: [...SUIVI_PARTIES_HEADERS],
    rows: suiviPartiesToExportRows(rows),
  });
}

export async function exportSuiviPartiesPdf(
  type: 'client' | 'fournisseur',
  rows: SuiviPartiesExportRow[]
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const title = type === 'client' ? 'Suivi clients' : 'Suivi fournisseurs';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Exporté le ${new Date().toLocaleString('fr-FR')}`, 14, 20);
  doc.text(`${rows.length} ligne${rows.length > 1 ? 's' : ''}`, 14, 25);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    head: [[...SUIVI_PARTIES_HEADERS]],
    body: suiviPartiesToExportRows(rows),
    startY: 30,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: type === 'client' ? [190, 18, 60] : [30, 58, 95], fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 28 },
      2: { cellWidth: 45 },
      3: { cellWidth: 32 },
      4: { cellWidth: 55 },
      5: { cellWidth: 28 },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${exportBaseName(type)}.pdf`);
}
