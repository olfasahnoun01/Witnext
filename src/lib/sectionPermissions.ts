export interface PermissionRow {
  section_key: string;
  subsection_key: string;
}

const COMMERCIAL_SUBSECTIONS = new Set(['gallery', 'rdv']);
const FLUX_ALIASES = new Set(['flux-suivi', 'flux-suivi-magasin', 'bc-fournisseur-reception']);

/** Galerie & RDV were under ventes; keep access for legacy permission rows. */
export function hasLegacyCommercialAccess(
  perms: PermissionRow[],
  subsectionId?: string
): boolean {
  const fullVentes = perms.some(
    (p) => p.section_key === 'ventes' && (!p.subsection_key || p.subsection_key === '')
  );
  if (fullVentes) return true;
  if (subsectionId) {
    return perms.some((p) => p.section_key === 'ventes' && p.subsection_key === subsectionId);
  }
  return perms.some(
    (p) =>
      p.section_key === 'ventes' &&
      p.subsection_key &&
      COMMERCIAL_SUBSECTIONS.has(p.subsection_key)
  );
}

/** True when the user was explicitly granted flux suivi (not via unrelated section access). */
export function hasFluxSuiviAccess(perms: PermissionRow[]): boolean {
  if (perms.some((p) => p.section_key === 'commercial' && (!p.subsection_key || p.subsection_key === ''))) {
    return true;
  }
  return perms.some(
    (p) => p.section_key === 'commercial' && p.subsection_key === 'flux-suivi'
  );
}

export interface SectionAccessContext {
  isAdmin: boolean;
  isModerator: boolean;
  perms: PermissionRow[];
  subsectionToSection: Record<string, string>;
}

/** Administration (comptes, paramètres) is reserved for the admin role only — never permission rows. */
export const ADMIN_ONLY_SECTION_ID = 'administration';
const ADMIN_ONLY_SUBSECTIONS = new Set(['accounts', 'settings']);

export function canAccessSectionWith(
  sectionId: string,
  { isAdmin, perms }: SectionAccessContext
): boolean {
  if (sectionId === ADMIN_ONLY_SECTION_ID) return isAdmin;
  if (isAdmin) return true;

  if (perms.some((p) => p.section_key === sectionId && (!p.subsection_key || p.subsection_key === ''))) {
    return true;
  }
  if (perms.some((p) => p.section_key === sectionId && p.subsection_key)) {
    return true;
  }
  if (sectionId === 'commercial') {
    return hasLegacyCommercialAccess(perms) || hasFluxSuiviAccess(perms);
  }
  return false;
}

export function canAccessSubsectionWith(
  subsectionId: string,
  ctx: SectionAccessContext
): boolean {
  const { isAdmin, perms, subsectionToSection } = ctx;
  if (ADMIN_ONLY_SUBSECTIONS.has(subsectionId)) return isAdmin;
  if (isAdmin) return true;

  const sectionId = subsectionToSection[subsectionId];
  if (!sectionId || sectionId === ADMIN_ONLY_SECTION_ID) return false;

  if (perms.some((p) => p.section_key === sectionId && (!p.subsection_key || p.subsection_key === ''))) {
    return true;
  }
  if (perms.some((p) => p.section_key === sectionId && p.subsection_key === subsectionId)) {
    return true;
  }
  if (sectionId === 'commercial' && COMMERCIAL_SUBSECTIONS.has(subsectionId)) {
    return hasLegacyCommercialAccess(perms, subsectionId);
  }
  if (subsectionId === 'suivi-parties') {
    if (hasLegacyCommercialAccess(perms)) return true;
    const crossSections = ['ventes', 'achats'] as const;
    if (
      crossSections.some((sec) =>
        perms.some((p) => p.section_key === sec && (!p.subsection_key || p.subsection_key === ''))
      )
    ) {
      return true;
    }
    return perms.some(
      (p) =>
        p.section_key === 'commercial' &&
        (p.subsection_key === 'suivi-parties' || !p.subsection_key || p.subsection_key === '')
    );
  }
  if (FLUX_ALIASES.has(subsectionId)) {
    return hasFluxSuiviAccess(perms);
  }
  return false;
}
