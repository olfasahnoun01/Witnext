import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { BIG_SECTIONS, SUBSECTION_TO_SECTION } from '@/config/navigation';
import { ensureSupabaseSessionReady, supabaseQueryWithAuthRetry } from '@/lib/supabaseSession';
import { formatError } from '@/lib/formatError';

interface PermissionRow {
  section_key: string;
  subsection_key: string; // '' = full section
}

const COMMERCIAL_SUBSECTIONS = new Set(['gallery', 'rdv']);
const FLUX_ALIASES = new Set(['flux-suivi', 'flux-suivi-magasin', 'bc-fournisseur-reception']);

/** Galerie & RDV were under ventes; keep access for legacy permission rows until DB migration runs. */
function hasLegacyCommercialAccess(perms: PermissionRow[], subsectionId?: string): boolean {
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

function hasFluxSuiviAccess(perms: PermissionRow[]): boolean {
  if (perms.some((p) => p.section_key === 'commercial' && p.subsection_key === 'flux-suivi')) {
    return true;
  }
  const crossSections = ['ventes', 'achats', 'magasin', 'finance'] as const;
  return crossSections.some((sec) =>
    perms.some((p) => p.section_key === sec && (!p.subsection_key || p.subsection_key === ''))
  );
}

export const usePermissions = () => {
  const { user, session, isAdmin, isLoading: authLoading } = useAuth();
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedForUserRef = useRef<string | null>(null);
  const userId = user?.id ?? null;
  const sessionReady = !authLoading && !!userId && !!session?.access_token;

  const load = useCallback(async (opts?: { background?: boolean }) => {
    if (!userId) {
      setPerms([]);
      setLoading(false);
      setLoadError(null);
      loadedForUserRef.current = null;
      return;
    }

    const hadCachedData = loadedForUserRef.current === userId;
    const background = opts?.background === true;

    if (!background) {
      setLoading(true);
      setLoadError(null);
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const ready = await ensureSupabaseSessionReady(attempt === 0 ? 12_000 : 5000);
      if (!ready) {
        await new Promise((r) => window.setTimeout(r, 400 * (attempt + 1)));
        continue;
      }

      const { data, error } = await supabaseQueryWithAuthRetry(() =>
        (supabase as any)
          .from('user_section_permissions')
          .select('section_key, subsection_key')
          .eq('user_id', userId)
      );

      if (!error) {
        setPerms((data ?? []) as PermissionRow[]);
        loadedForUserRef.current = userId;
        setLoadError(null);
        setLoading(false);
        return;
      }

      console.warn(`[Permissions] load attempt ${attempt + 1} failed:`, error.message);
      await new Promise((r) => window.setTimeout(r, 500 * (attempt + 1)));
    }

    console.error('[Permissions] all load attempts failed for user', userId);
    if (background && hadCachedData) {
      console.warn('[Permissions] background reload failed — keeping cached permissions');
      return;
    }
    setLoadError('Impossible de charger vos permissions. Réessayez ou reconnectez-vous.');
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!sessionReady) {
      if (!authLoading && !userId) {
        setPerms([]);
        setLoading(false);
        setLoadError(null);
        loadedForUserRef.current = null;
      }
      return;
    }
    void load().catch((err) => {
      console.error('[Permissions] load failed:', err);
      if (loadedForUserRef.current === userId) return;
      setLoadError(formatError(err, 'Impossible de charger vos permissions.'));
      setLoading(false);
    });
  }, [sessionReady, authLoading, userId, load]);

  useSessionResumeReload(() => load({ background: true }));

  const canAccessSection = useCallback(
    (sectionId: string): boolean => {
      if (isAdmin) return true;
      // full section grant
      if (perms.some((p) => p.section_key === sectionId && (!p.subsection_key || p.subsection_key === ''))) {
        return true;
      }
      // any sub-section grant under this section
      if (perms.some((p) => p.section_key === sectionId && p.subsection_key)) {
        return true;
      }
      if (sectionId === 'commercial') {
        return hasLegacyCommercialAccess(perms) || hasFluxSuiviAccess(perms);
      }
      return false;
    },
    [isAdmin, perms]
  );

  const canAccessSubsection = useCallback(
    (subsectionId: string): boolean => {
      if (isAdmin) return true;
      const sectionId = SUBSECTION_TO_SECTION[subsectionId];
      if (!sectionId) return false;
      // Full section grant
      if (perms.some((p) => p.section_key === sectionId && (!p.subsection_key || p.subsection_key === ''))) {
        return true;
      }
      // Specific sub-section grant
      if (perms.some((p) => p.section_key === sectionId && p.subsection_key === subsectionId)) {
        return true;
      }
      if (sectionId === 'commercial' && COMMERCIAL_SUBSECTIONS.has(subsectionId)) {
        return hasLegacyCommercialAccess(perms, subsectionId);
      }
      if (FLUX_ALIASES.has(subsectionId)) {
        return hasFluxSuiviAccess(perms);
      }
      return false;
    },
    [isAdmin, perms]
  );

  const visibleSections = BIG_SECTIONS.filter((s) => canAccessSection(s.id));

  const firstAllowedSubsection = (sectionId: string): string | null => {
    const section = BIG_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return null;
    const sub = section.subsections.find((sub) => canAccessSubsection(sub.id));
    return sub?.id ?? null;
  };

  return {
    loading,
    loadError,
    isAdmin,
    canAccessSection,
    canAccessSubsection,
    visibleSections,
    firstAllowedSubsection,
    reload: load,
  };
};
