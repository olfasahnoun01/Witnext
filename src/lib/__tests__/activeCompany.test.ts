import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveActiveCompanyId,
  withCompany,
  getActiveCompanyId,
  setActiveCompanyId,
  onActiveCompanyChange,
  applyActiveCompanyFromStorage,
} from '../activeCompany';

const GROSAFE = { id: '11111111-1111-1111-1111-111111111111', code: 'grosafe', name: 'Grosafe' };
const GRANISAFE = { id: '22222222-2222-2222-2222-222222222222', code: 'granisafe', name: 'Granisafe' };
const SAFE_TEAM = { id: '33333333-3333-3333-3333-333333333333', code: 'safe_team', name: 'Safe Team' };

describe('resolveActiveCompanyId', () => {
  it('keeps a persisted company when the user still has access', () => {
    const companies = [GROSAFE, GRANISAFE];
    expect(resolveActiveCompanyId(companies, GRANISAFE.id)).toBe(GRANISAFE.id);
  });

  it('rejects a persisted company the user no longer belongs to (cross-company leak guard)', () => {
    const companies = [GROSAFE];
    const staleGranisafeId = GRANISAFE.id;
    expect(resolveActiveCompanyId(companies, staleGranisafeId)).toBe(GROSAFE.id);
  });

  it('defaults to Grosafe when persisted choice is invalid', () => {
    const companies = [GRANISAFE, GROSAFE, SAFE_TEAM];
    expect(resolveActiveCompanyId(companies, null)).toBe(GROSAFE.id);
  });

  it('falls back to first company when Grosafe is absent', () => {
    const companies = [GRANISAFE, SAFE_TEAM];
    expect(resolveActiveCompanyId(companies, null)).toBe(GRANISAFE.id);
  });

  it('returns null when the user has no companies', () => {
    expect(resolveActiveCompanyId([], null)).toBeNull();
    expect(resolveActiveCompanyId([], GROSAFE.id)).toBeNull();
  });
});

describe('withCompany', () => {
  beforeEach(() => {
    setActiveCompanyId(null);
  });

  it('stamps company_id from the active company on insert payloads', () => {
    setActiveCompanyId(GRANISAFE.id);
    expect(withCompany({ name: 'Widget' })).toEqual({
      name: 'Widget',
      company_id: GRANISAFE.id,
    });
  });

  it('leaves payload unchanged when no active company is set', () => {
    expect(withCompany({ sku: 'A-1' })).toEqual({ sku: 'A-1' });
  });
});

describe('setActiveCompanyId / onActiveCompanyChange', () => {
  beforeEach(() => {
    setActiveCompanyId(null);
  });

  it('notifies subscribers when the active company changes', () => {
    const listener = vi.fn();
    const unsubscribe = onActiveCompanyChange(listener);

    setActiveCompanyId(GROSAFE.id);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getActiveCompanyId()).toBe(GROSAFE.id);

    setActiveCompanyId(GRANISAFE.id);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setActiveCompanyId(SAFE_TEAM.id);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when setting the same company id twice', () => {
    const listener = vi.fn();
    onActiveCompanyChange(listener);
    setActiveCompanyId(GROSAFE.id);
    setActiveCompanyId(GROSAFE.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('applyActiveCompanyFromStorage', () => {
  beforeEach(() => {
    setActiveCompanyId(null);
  });

  it('updates in-memory company without writing localStorage', () => {
    const listener = vi.fn();
    onActiveCompanyChange(listener);

    const result = applyActiveCompanyFromStorage(GRANISAFE.id);
    expect(result).toEqual({ id: GRANISAFE.id, changed: true });
    expect(getActiveCompanyId()).toBe(GRANISAFE.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns changed: false when the stored id matches', () => {
    setActiveCompanyId(GROSAFE.id);
    const listener = vi.fn();
    onActiveCompanyChange(listener);

    const result = applyActiveCompanyFromStorage(GROSAFE.id);
    expect(result).toEqual({ id: GROSAFE.id, changed: false });
    expect(listener).not.toHaveBeenCalled();
  });

  it('clears the active company when storage is removed', () => {
    setActiveCompanyId(GROSAFE.id);
    const result = applyActiveCompanyFromStorage(null);
    expect(result).toEqual({ id: null, changed: true });
    expect(getActiveCompanyId()).toBeNull();
  });
});
