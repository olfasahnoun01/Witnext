import { supabase } from '@/integrations/supabase/client';
import type { BonCommande, DevisItem, UnifiedDocument } from '@/types';
import { enrichUnifiedDocumentDisplay } from '@/lib/unifiedDocumentDisplay';

/** Stable negative numeric id for React keys (legacy rows use positive devis ids). */
export function documentUuidToSyntheticDevisId(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = (Math.imul(31, h) + uuid.charCodeAt(i)) | 0;
  }
  const n = Math.abs(h) || 1;
  return -n;
}

function mapDocumentLineToDevisItem(line: {
  quantity: number;
  unit_price: number;
  description?: string | null;
  products?: { name?: string; sku?: string } | null;
}): DevisItem {
  return {
    designation: line.products?.name || line.description || 'Article',
    fournisseur: '',
    prix_ttc: Number(line.unit_price) || 0,
    remise: 0,
    quantity: Number(line.quantity) || 0,
    sku: line.products?.sku || undefined,
    description: line.description || undefined,
    product_id: undefined,
  };
}

/** Loads v2 BC_FOURNISSEUR rows for the Achats → BC fournisseurs list. */
export async function fetchBcFournisseurDocumentsAsBonCommande(): Promise<BonCommande[]> {
  const { data, error } = await supabase
    .from('documents')
    .select(
      `
      *,
      fournisseurs(nom),
      document_lines(
        *,
        products(name, sku)
      )
    `
    )
    .eq('type', 'BC_FOURNISSEUR')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  if (!data?.length) return [];

  return data.map((row) => {
    const doc = enrichUnifiedDocumentDisplay({
      ...row,
      metadata: row.metadata ?? {},
      fournisseur_name: row.fournisseurs?.nom,
      lines: row.document_lines,
    } as UnifiedDocument);

    const items: DevisItem[] = (row.document_lines || []).map(mapDocumentLineToDevisItem);
    const fournisseurNom = doc.fournisseur_name || row.fournisseurs?.nom || null;
    const clientNom = doc.client_name || null;
    const created = row.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];

    return {
      id: documentUuidToSyntheticDevisId(row.id),
      document_v2_id: row.id,
      type: 'achat',
      devis_number: row.numero,
      devis_date: created,
      third_party_name: fournisseurNom,
      source_client_name: clientNom,
      third_party_address: null,
      third_party_tax_id: null,
      third_party_phone: null,
      items,
      total_amount: items.reduce((s, i) => s + i.quantity * i.prix_ttc, 0),
      notes: row.notes,
      status: 'confirmé',
      is_ttc: true,
      is_bc: true,
      is_ba: false,
      source_devis_id: null,
      source_bc_id: null,
      source_bc_number:
        typeof row.metadata?.source_bc_numero === 'string' ? row.metadata.source_bc_numero : null,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as BonCommande;
  });
}
