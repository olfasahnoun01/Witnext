import { supabase } from '@/integrations/supabase/client';
import type { BonLivraison, DevisItem, UnifiedDocument } from '@/types';
import {
  documentUuidToSyntheticDevisId,
} from '@/lib/bcFournisseurList';
import {
  enrichUnifiedDocumentDisplay,
  resolveUnifiedDocumentTierName,
} from '@/lib/unifiedDocumentDisplay';
import {
  attachProfileNames,
  buildProfilesMap,
  collectUserIdsForProfiles,
} from '@/lib/documentListAudit';
import {
  supabaseQueryWithAuthRetry,
} from '@/lib/supabaseSession';

function mapDocumentLineToDevisItem(line: {
  quantity: number;
  unit_price: number;
  product_id?: number | null;
  description?: string | null;
  products?: { name?: string; sku?: string } | null;
}): DevisItem {
  const rawDescription = line.description || '';
  let designation = line.products?.name || '';
  let description = rawDescription;

  if (!designation && rawDescription) {
    const sep = ' — ';
    const idx = rawDescription.indexOf(sep);
    if (idx >= 0) {
      designation = rawDescription.slice(0, idx).trim();
      description = rawDescription.slice(idx + sep.length).trim();
    } else {
      designation = rawDescription;
      description = '';
    }
  }

  return {
    designation: designation || 'Article',
    fournisseur: '',
    prix_ttc: Number(line.unit_price) || 0,
    remise: 0,
    quantity: Number(line.quantity) || 0,
    sku: line.products?.sku || undefined,
    description: description || undefined,
    product_id: line.product_id ?? undefined,
  };
}

function isClientDeliveryBl(row: { metadata?: Record<string, unknown> | null }): boolean {
  const purpose = row.metadata?.bl_purpose;
  // Exclude intermagasin transfers; include classic client BLs (incl. legacy without bl_purpose).
  return purpose !== 'magasin_transfer';
}

/**
 * Loads Magasin & Stock BL_CLIENT (client deliveries) for the Ventes → Bons de Livraison list.
 */
export async function fetchBlClientDocumentsAsBonLivraison(): Promise<BonLivraison[]> {
  const { data, error } = await supabase
    .from('documents')
    .select(
      `
      *,
      clients(nom),
      document_lines(
        *,
        products(name, sku)
      )
    `
    )
    .eq('type', 'BL_CLIENT')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  if (!data?.length) return [];

  const clientRows = data.filter(isClientDeliveryBl);
  const userIds = collectUserIdsForProfiles(clientRows);
  let profilesMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseQueryWithAuthRetry(() =>
      supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds)
    );
    if (profilesError) {
      console.warn('[blClientList] profiles load failed:', profilesError.message);
    } else if (profiles?.length) {
      profilesMap = buildProfilesMap(profiles);
    }
  }

  return clientRows.map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const enriched = attachProfileNames(
      enrichUnifiedDocumentDisplay({
        ...row,
        metadata: meta,
        client_name: row.clients?.nom,
        lines: row.document_lines,
      } as UnifiedDocument),
      profilesMap
    );

    const items: DevisItem[] = (row.document_lines || []).map(mapDocumentLineToDevisItem);
    const clientName =
      resolveUnifiedDocumentTierName(enriched) ||
      (typeof meta.third_party_name === 'string' ? meta.third_party_name : null) ||
      row.clients?.nom ||
      null;
    const docDate =
      (typeof meta.document_date === 'string' && meta.document_date) ||
      row.created_at?.split('T')[0] ||
      new Date().toISOString().split('T')[0];

    return {
      id: documentUuidToSyntheticDevisId(row.id),
      document_v2_id: row.id,
      type: 'vente',
      devis_number: row.numero,
      devis_date: docDate,
      third_party_name: clientName,
      third_party_address:
        typeof meta.third_party_address === 'string' ? meta.third_party_address : null,
      third_party_tax_id:
        typeof meta.third_party_tax_id === 'string' ? meta.third_party_tax_id : null,
      third_party_phone:
        typeof meta.third_party_phone === 'string' ? meta.third_party_phone : null,
      items,
      total_amount: items.reduce((s, i) => s + i.quantity * i.prix_ttc, 0),
      notes: row.notes,
      status: 'confirmé',
      is_ttc: true,
      is_bc: false,
      is_ba: false,
      is_bl: true,
      source_devis_id: null,
      source_bc_id: null,
      source_bc_number:
        typeof meta.source_bc_numero === 'string' ? meta.source_bc_numero : null,
      created_by: row.created_by,
      creator_name: enriched.creator_name,
      modifier_name: enriched.modifier_name,
      updated_by: row.updated_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as BonLivraison;
  });
}
