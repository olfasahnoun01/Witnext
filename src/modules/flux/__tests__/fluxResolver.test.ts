import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  },
}));

import {
  computeFluxMetrics,
  resolveFluxSteps,
  filterDossiersByTab,
  missingStepChips,
} from '../services/fluxResolver';
import type { FluxContextData } from '../services/fluxResolver';
import { FLUX_STEP_LABELS } from '../types/dossierTypes';

type DevisRow = {
  id: number;
  devis_number: string;
  devis_date: string;
  type: string;
  is_bc: boolean;
  is_ba: boolean;
  status: string;
  third_party_name: string | null;
  third_party_address: string | null;
  third_party_tax_id: string | null;
  third_party_phone: string | null;
  total_amount: number | null;
  items: unknown;
  source_devis_id: number | null;
  is_ttc: boolean;
  notes: string | null;
  created_at: string;
};

function minimalBc(overrides: Partial<DevisRow> = {}): DevisRow {
  return {
    id: 100,
    devis_number: 'BC-2026-001',
    devis_date: '2026-01-01',
    type: 'vente',
    is_bc: true,
    is_ba: false,
    status: 'confirmé',
    third_party_name: 'Client Test',
    third_party_address: null,
    third_party_tax_id: null,
    third_party_phone: null,
    total_amount: 1000,
    items: [],
    source_devis_id: 50,
    is_ttc: false,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function emptyCtx(overrides: Partial<FluxContextData> = {}): FluxContextData {
  return {
    devisById: new Map(),
    legacyBlByBcId: new Map(),
    docs: [],
    factures: [],
    financeInvoices: [],
    promotedBcByLegacyId: new Map(),
    bcFournisseurByVenteDevisId: new Map(),
    childrenByParentId: new Map(),
    factureByBcId: new Map(),
    factureByBlId: new Map(),
    financeBySourceId: new Map(),
    demandeAchatByBcDocId: new Map(),
    ...overrides,
  };
}

describe('computeFluxMetrics', () => {
  it('marks incomplete when required BC fournisseur is missing', () => {
    const bc = minimalBc();
    const ctx = emptyCtx({
      devisById: new Map([
        [50, { ...minimalBc({ id: 50, is_bc: false, devis_number: 'DEV-001', status: 'accepté' }) }],
        [100, bc],
      ]),
    });
    const steps = resolveFluxSteps(bc, ctx);
    const metrics = computeFluxMetrics(steps);
    expect(metrics.health).toBe('incomplete');
    expect(metrics.missingSteps).toContain('bc_fournisseur');
    expect(metrics.nextActionLabel).toMatch(/BC fournisseur/i);
  });

  it('computes progress when BC client is done', () => {
    const bc = minimalBc();
    const ctx = emptyCtx({ devisById: new Map([[100, bc]]) });
    const steps = resolveFluxSteps(bc, ctx);
    const metrics = computeFluxMetrics(steps);
    expect(metrics.completionPercent).toBeGreaterThan(0);
    expect(steps.find((s) => s.key === 'bc_client')?.status).toBe('done');
  });
});

describe('filterDossiersByTab', () => {
  it('filters incomplete dossiers', () => {
    const list = [
      { health: 'incomplete', isComplete: false } as any,
      { health: 'complete', isComplete: true } as any,
    ];
    expect(filterDossiersByTab(list, 'incomplets')).toHaveLength(1);
    expect(filterDossiersByTab(list, 'termines')).toHaveLength(1);
  });
});

describe('missingStepChips', () => {
  it('returns short chip labels', () => {
    const chips = missingStepChips(['bc_fournisseur', 'bl_vente']);
    expect(chips).toContain('BC fr.');
    expect(chips).toContain('BL');
  });
});

describe('FLUX_STEP_LABELS', () => {
  it('has French labels for all steps', () => {
    expect(FLUX_STEP_LABELS.facture_client).toBe('Facture client');
    expect(FLUX_STEP_LABELS.reception_stock).toMatch(/Réception/);
  });
});
