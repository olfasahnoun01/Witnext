import type { UnifiedDocument } from '@/types';

function metaString(doc: UnifiedDocument, key: string): string | null {
  const v = doc.metadata?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function isSupplierFacingDoc(doc: UnifiedDocument): boolean {
  return (
    doc.type === 'BE' ||
    doc.type === 'BL_FOURNISSEUR' ||
    doc.type === 'BC_FOURNISSEUR' ||
    doc.type === 'DEVIS_FOURNISSEUR'
  );
}

/** Client label for BC_CLIENT / BC_FOURNISSEUR cards and lists. */
export function resolveUnifiedDocumentClientName(doc: UnifiedDocument): string | null {
  return (
    doc.client_name?.trim() ||
    metaString(doc, 'source_bc_client_name') ||
    metaString(doc, 'client_name') ||
    (!isSupplierFacingDoc(doc) ? metaString(doc, 'third_party_name') : null) ||
    null
  );
}

/** Fournisseur label for BC_FOURNISSEUR (user selection or FK join). */
export function resolveUnifiedDocumentFournisseurName(doc: UnifiedDocument): string | null {
  return (
    doc.fournisseur_name?.trim() ||
    metaString(doc, 'source_fournisseur_name') ||
    metaString(doc, 'fournisseur_name') ||
    (isSupplierFacingDoc(doc) ? metaString(doc, 'third_party_name') : null) ||
    null
  );
}

/** Display label for the "Tiers" row (BL / BE / BS cards). */
export function resolveUnifiedDocumentTierName(doc: UnifiedDocument): string | null {
  return (
    resolveUnifiedDocumentFournisseurName(doc) ||
    resolveUnifiedDocumentClientName(doc) ||
    metaString(doc, 'third_party_name') ||
    null
  );
}

export function enrichUnifiedDocumentDisplay<T extends UnifiedDocument>(doc: T): T {
  return {
    ...doc,
    client_name: resolveUnifiedDocumentClientName(doc) ?? doc.client_name,
    fournisseur_name: resolveUnifiedDocumentFournisseurName(doc) ?? doc.fournisseur_name,
  };
}
