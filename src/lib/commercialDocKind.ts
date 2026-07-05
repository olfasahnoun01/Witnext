export type CommercialDocKind =
  | 'DEVIS_CLIENT'
  | 'DEVIS_FOURNISSEUR'
  | 'BC_CLIENT'
  | 'BC_FOURNISSEUR'
  | 'OTHER';

export const COMMERCIAL_DOC_KIND_LABELS: Record<CommercialDocKind, string> = {
  DEVIS_CLIENT: 'Devis client',
  DEVIS_FOURNISSEUR: 'Devis fournisseur',
  BC_CLIENT: 'BC client',
  BC_FOURNISSEUR: 'BC fournisseur',
  OTHER: 'Autre',
};

export interface CommercialDocRow {
  type: string;
  is_bc?: boolean | null;
  is_bl?: boolean | null;
  is_ba?: boolean | null;
}

export function classifyCommercialDoc(row: CommercialDocRow): CommercialDocKind {
  if (row.is_bl || row.is_ba) return 'OTHER';
  const isVente = row.type === 'vente' || row.type === 'sortant';
  const isAchat = row.type === 'achat' || row.type === 'entrant';
  if (row.is_bc && isVente) return 'BC_CLIENT';
  if (row.is_bc && isAchat) return 'BC_FOURNISSEUR';
  if (!row.is_bc && isVente) return 'DEVIS_CLIENT';
  if (!row.is_bc && isAchat) return 'DEVIS_FOURNISSEUR';
  return 'OTHER';
}

export type CommercialDocCounts = Record<CommercialDocKind, number>;

export function emptyCommercialDocCounts(): CommercialDocCounts {
  return {
    DEVIS_CLIENT: 0,
    DEVIS_FOURNISSEUR: 0,
    BC_CLIENT: 0,
    BC_FOURNISSEUR: 0,
    OTHER: 0,
  };
}

export function incrementDocCount(counts: CommercialDocCounts, kind: CommercialDocKind): CommercialDocCounts {
  return { ...counts, [kind]: counts[kind] + 1 };
}

export function totalTrackedActivity(counts: CommercialDocCounts): number {
  return (
    counts.DEVIS_CLIENT +
    counts.DEVIS_FOURNISSEUR +
    counts.BC_CLIENT +
    counts.BC_FOURNISSEUR
  );
}
