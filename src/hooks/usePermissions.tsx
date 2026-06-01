import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BIG_SECTIONS, SUBSECTION_TO_SECTION } from '@/config/navigation';

interface PermissionRow {
  section_key: string;
  subsection_key: string; // '' = full section
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

  const canAccessSection = useCallback(
    (sectionId: string): boolean => {
      if (isAdmin) return true;
      // full section grant
      if (perms.some((p) => p.section_key === sectionId && (!p.subsection_key || p.subsection_key === ''))) {
        return true;
      }
      // any sub-section grant under this section
      return perms.some((p) => p.section_key === sectionId && p.subsection_key);
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
      return perms.some((p) => p.section_key === sectionId && p.subsection_key === subsectionId);
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
