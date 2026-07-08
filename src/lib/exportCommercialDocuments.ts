import { exportExcelTable } from '@/lib/exportExcel';
import { formatDerniereModification, formatModifieePar } from '@/lib/documentListAudit';
import { formatAppDate } from '@/lib/formatAppDate';
import { getBcClientDisplayName, getBcFournisseurDisplayName } from '@/lib/bcListDisplay';
import { computeDevisTotals, resolveFodecEnabled } from '@/lib/devisPricing';
import { isDevisConfirmed } from '@/lib/devisListLayout';
import type { BonCommande, Devis } from '@/types';

export const DEVIS_EXPORT_HEADERS = [
  'Type',
  'N° Devis',
  'Date',
  'Tiers',
  'Matricule fiscale',
  'Téléphone',
  'Créé par',
  'Dernière modification',
  'Modifiée par',
  'Statut',
  'Confirmation',
  'Nb articles',
  'Quantité totale',
  'Total TTC',
  'Mode',
  'Notes',
] as const;

export const BC_EXPORT_HEADERS = [
  'Type',
  'N° BC',
  'Devis source',
  'Date',
  'Client',
  'Fournisseur',
  'Créé par',
  'Dernière modification',
  'Modifiée par',
  'Statut',
  'Nb articles',
  'Quantité totale',
  'Total TTC',
  'Notes',
] as const;

/** Filter documents whose `devis_date` falls on the given yyyy-MM-dd day (empty = no filter). */
export function matchesCommercialDocumentDay(
  devisDate: string | null | undefined,
  day: string
): boolean {
  if (!day.trim()) return true;
  if (!devisDate) return false;
  return devisDate.slice(0, 10) === day.trim();
}

function devisTypeLabel(type: Devis['type']): string {
  return type === 'achat' || type === 'entrant' ? 'Achat' : 'Vente';
}

function confirmationLabel(status: Devis['status'] | undefined | null): string {
  return isDevisConfirmed(status) ? 'Confirmé' : 'Non confirmé';
}

function formatTotalTtc(d: Devis): string {
  const totals = computeDevisTotals(d.items, false, {
    devisType: d.type === 'achat' || d.type === 'entrant' ? 'achat' : 'vente',
    docType: d.is_bc ? 'bc' : 'devis',
    isTvaEnabled: d.is_ttc,
    isFodecEnabled: resolveFodecEnabled({
      devisType: d.type === 'achat' || d.type === 'entrant' ? 'achat' : 'vente',
      items: d.items,
    }),
  });
  return totals.totalFinal > 0 ? totals.totalFinal.toFixed(3) : '';
}

export function devisListToExportRows(items: Devis[]): (string | number)[][] {
  return items.map((d) => {
    const totalQty = d.items.reduce((sum, item) => sum + item.quantity, 0);
    return [
      devisTypeLabel(d.type),
      d.devis_number,
      formatAppDate(d.devis_date),
      d.third_party_name ?? '',
      d.third_party_tax_id ?? '',
      d.third_party_phone ?? '',
      d.creator_name ?? '',
      formatDerniereModification(d),
      formatModifieePar(d),
      d.status ?? '',
      confirmationLabel(d.status),
      d.items.length,
      totalQty,
      formatTotalTtc(d),
      d.is_ttc ? 'TTC' : 'HT',
      d.notes?.trim() ?? '',
    ];
  });
}

export function bcListToExportRows(items: BonCommande[]): (string | number)[][] {
  return items.map((bc) => {
    const totalQty = bc.items.reduce((sum, item) => sum + item.quantity, 0);
    return [
      devisTypeLabel(bc.type),
      bc.devis_number,
      bc.source_devis_number ?? '',
      formatAppDate(bc.devis_date),
      getBcClientDisplayName(bc),
      getBcFournisseurDisplayName(bc),
      bc.creator_name ?? '',
      formatDerniereModification(bc),
      formatModifieePar(bc),
      bc.status ?? '',
      bc.items.length,
      totalQty,
      formatTotalTtc(bc),
      bc.notes?.trim() ?? '',
    ];
  });
}

function exportFilename(prefix: string, typeScope: string, filterDay: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (filterDay) return `${prefix}-${typeScope}-jour-${filterDay}.xlsx`;
  return `${prefix}-${typeScope}-${stamp}.xlsx`;
}

function headerColorForScope(typeScope: 'achat' | 'vente' | 'all', kind: 'devis' | 'bc'): string {
  if (typeScope === 'achat') return 'FFEA580C';
  if (typeScope === 'vente') return kind === 'bc' ? 'FF059669' : 'FF047857';
  return 'FF1E3A5F';
}

export async function exportDevisListExcel(
  items: Devis[],
  opts: { typeScope: 'achat' | 'vente' | 'all'; filterDay?: string }
): Promise<void> {
  const filterDay = opts.filterDay?.trim() ?? '';
  await exportExcelTable({
    filename: exportFilename('devis', opts.typeScope, filterDay),
    sheetName: 'Devis',
    headerColor: headerColorForScope(opts.typeScope, 'devis'),
    headers: [...DEVIS_EXPORT_HEADERS],
    rows: devisListToExportRows(items),
  });
}

export async function exportBcListExcel(
  items: BonCommande[],
  opts: { typeScope: 'achat' | 'vente' | 'all'; filterDay?: string }
): Promise<void> {
  const filterDay = opts.filterDay?.trim() ?? '';
  await exportExcelTable({
    filename: exportFilename('bc', opts.typeScope, filterDay),
    sheetName: 'Bons de commande',
    headerColor: headerColorForScope(opts.typeScope, 'bc'),
    headers: [...BC_EXPORT_HEADERS],
    rows: bcListToExportRows(items),
  });
}
