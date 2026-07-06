import { describe, expect, it } from 'vitest';
import { SUBSECTION_TO_SECTION } from '@/config/navigation';
import {
  canAccessSectionWith,
  canAccessSubsectionWith,
  hasFluxSuiviAccess,
  type PermissionRow,
} from '@/lib/sectionPermissions';

const ctx = (perms: PermissionRow[], isAdmin = false, isModerator = false) => ({
  isAdmin,
  isModerator,
  perms,
  subsectionToSection: SUBSECTION_TO_SECTION,
});

describe('sectionPermissions', () => {
  it('admin sees all sections', () => {
    expect(canAccessSectionWith('finance', ctx([], true))).toBe(true);
    expect(canAccessSubsectionWith('settings', ctx([], true))).toBe(true);
  });

  it('only admin sees administration section and subsections', () => {
    expect(canAccessSectionWith('administration', ctx([], false, true))).toBe(false);
    expect(canAccessSectionWith('administration', ctx([], true))).toBe(true);
    expect(canAccessSubsectionWith('accounts', ctx([], false, true))).toBe(false);
    expect(canAccessSubsectionWith('accounts', ctx([], true))).toBe(true);
    expect(canAccessSubsectionWith('settings', ctx([], true))).toBe(true);
    expect(canAccessSubsectionWith('settings', ctx([], false, true))).toBe(false);
  });

  it('administration permission rows do not grant access to non-admins', () => {
    const perms: PermissionRow[] = [
      { section_key: 'administration', subsection_key: '' },
      { section_key: 'administration', subsection_key: 'accounts' },
    ];
    expect(canAccessSectionWith('administration', ctx(perms))).toBe(false);
    expect(canAccessSubsectionWith('accounts', ctx(perms))).toBe(false);
  });

  it('regular user with no permissions sees nothing except denied subsections', () => {
    expect(canAccessSectionWith('ventes', ctx([]))).toBe(false);
    expect(canAccessSubsectionWith('inventory', ctx([]))).toBe(false);
  });

  it('magasin grant does not unlock flux suivi via cross-section shortcut', () => {
    const perms: PermissionRow[] = [{ section_key: 'magasin', subsection_key: '' }];
    expect(hasFluxSuiviAccess(perms)).toBe(false);
    expect(canAccessSectionWith('commercial', ctx(perms))).toBe(false);
    expect(canAccessSubsectionWith('flux-suivi', ctx(perms))).toBe(false);
    expect(canAccessSubsectionWith('inventory', ctx(perms))).toBe(true);
  });

  it('flux suivi permission row is still recognized for legacy access checks', () => {
    const perms: PermissionRow[] = [
      { section_key: 'commercial', subsection_key: 'flux-suivi' },
    ];
    expect(hasFluxSuiviAccess(perms)).toBe(true);
  });

  it('subsection grant unlocks parent section visibility', () => {
    const perms: PermissionRow[] = [
      { section_key: 'ventes', subsection_key: 'devis-vente' },
    ];
    expect(canAccessSectionWith('ventes', ctx(perms))).toBe(true);
    expect(canAccessSubsectionWith('devis-vente', ctx(perms))).toBe(true);
    expect(canAccessSubsectionWith('bc-vente', ctx(perms))).toBe(false);
  });
});
