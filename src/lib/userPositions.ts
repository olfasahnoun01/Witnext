/** Normalise un libellé de poste pour comparaison (sans accents, minuscules). */
export function normalizePosteKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

const POSTE_ALIASES: Record<string, string[]> = {
  'responsable commerciale': ['responsable commerciale', 'responsable commercial'],
  'responsable magazin': ['responsable magazin', 'responsable magasin', 'responsable stock'],
  'responsable achat': ['responsable achat'],
  'responsable administrative': ['responsable administrative', 'responsable administratif'],
  'responsable financier': ['responsable financier', 'responsable finance'],
  'directeur generale': ['directeur generale', 'directeur general', 'directeur générale', 'directeur général', 'dg'],
};

/** Postes avec accès automatique à toutes les sociétés Finance (Grosafe, Granisafe, Safe-Team). */
export const POSTES_ALL_FINANCE_COMPANIES = [
  'directeur generale',
  'responsable financier',
  'responsable administrative',
] as const;

export function posteHasAllFinanceCompanies(userPosition: string): boolean {
  return posteMatches(userPosition, [...POSTES_ALL_FINANCE_COMPANIES]);
}

export function posteMatches(userPosition: string, targetKeys: string[]): boolean {
  const userKey = normalizePosteKey(userPosition);
  if (!userKey) return false;
  for (const target of targetKeys) {
    const aliases = POSTE_ALIASES[target] ?? [target];
    for (const alias of aliases) {
      const aliasKey = normalizePosteKey(alias);
      if (userKey === aliasKey || userKey.includes(aliasKey) || aliasKey.includes(userKey)) {
        return true;
      }
    }
  }
  return false;
}
