import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { BIG_SECTIONS, SUBSECTION_TO_SECTION } from '@/config/navigation';

interface PermissionRow {
  section_key: string;
  subsection_key: string; // '' = full section
}

const COMMERCIAL_SUBSECTIONS = new Set(['gallery', 'rdv']);

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

export const usePermissions = () => {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedForUserRef = useRef<string | null>(null);
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) {
      setPerms([]);
      setLoading(false);
      loadedForUserRef.current = null;
      return;
    }

    const isInitialLoadForUser = loadedForUserRef.current !== userId;
    if (isInitialLoadForUser) {
      setLoading(true);
    }

    const { data, error } = await (supabase as any)
      .from('user_section_permissions')
      .select('section_key, subsection_key')
      .eq('user_id', userId);
    if (!error && data) setPerms(data as PermissionRow[]);
    loadedForUserRef.current = userId;
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!authLoading) {
      void load().catch((err) => console.error('[Permissions] load failed:', err));
    }
  }, [authLoading, load]);

  useSessionResumeReload(load);

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
        return hasLegacyCommercialAccess(perms);
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
    isAdmin,
    canAccessSection,
    canAccessSubsection,
    visibleSections,
    firstAllowedSubsection,
    reload: load,
  };
};
