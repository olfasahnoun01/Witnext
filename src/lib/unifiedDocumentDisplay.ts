import type { UnifiedDocument } from '@/types';

function metaString(doc: UnifiedDocument, key: string): string | null {
  const v = doc.metadata?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Client label for BC_CLIENT / BC_FOURNISSEUR cards and lists. */
export function resolveUnifiedDocumentClientName(doc: UnifiedDocument): string | null {
  return (
    doc.client_name?.trim() ||
    metaString(doc, 'source_bc_client_name') ||
    metaString(doc, 'client_name') ||
    null
  );
}

/** Fournisseur label for BC_FOURNISSEUR (user selection or FK join). */
export function resolveUnifiedDocumentFournisseurName(doc: UnifiedDocument): string | null {
  return (
    doc.fournisseur_name?.trim() ||
    metaString(doc, 'source_fournisseur_name') ||
    metaString(doc, 'fournisseur_name') ||
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
