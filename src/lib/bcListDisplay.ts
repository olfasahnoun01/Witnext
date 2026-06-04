import type { BonCommande } from '@/types';

/** Client name on a vente BC (commande client). */
export function getBcClientDisplayName(bc: BonCommande): string {
  if (bc.type === 'vente') {
    return bc.third_party_name?.trim() || '—';
  }
  if (bc.type === 'achat') {
    return bc.source_client_name?.trim() || '—';
  }
  return '—';
}

/** Fournisseur(s) on lines (vente BC) or selected supplier on achat BC. */
export function getBcFournisseurDisplayName(bc: BonCommande): string {
  if (bc.type === 'achat') {
    return bc.third_party_name?.trim() || '—';
  }
  const names = [
    ...new Set(
      bc.items
        .map((i) => i.fournisseur?.trim())
        .filter((n): n is string => Boolean(n))
    ),
  ];
  return names.length > 0 ? names.join(', ') : '—';
}
