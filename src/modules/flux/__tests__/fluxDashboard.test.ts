import { describe, expect, it } from 'vitest';
import type { FluxDossierDetail } from '../types/dossierTypes';
import { buildFluxDashboardAlerts, computeFluxDashboardSummary } from '../services/fluxDashboard';

function mockDossier(partial: Partial<FluxDossierDetail>): FluxDossierDetail {
  return {
    id: '1',
    company_id: 'c1',
    dossier_number: 'FLX-2026-00001',
    direction: 'vente',
    status: 'active',
    client_id: null,
    fournisseur_id: null,
    client_name: 'Client Test',
    fournisseur_name: null,
    anchor_devis_id: null,
    anchor_bc_devis_id: 1,
    anchor_document_id: null,
    bc_reference: 'BCS-01',
    devis_reference: null,
    assigned_user_id: null,
    assigned_role: 'commercial',
    current_step: 'bc_fournisseur',
    health: 'incomplete',
    missing_steps: ['bc_fournisseur'],
    missingSteps: ['bc_fournisseur'],
    completion_percent: 40,
    next_action_label: 'Manque : BC fournisseur',
    due_date: null,
    created_at: '',
    updated_at: '',
    created_by: null,
    steps: [],
    missingDocumentLabels: ['BC fournisseur'],
    completedSteps: 4,
    totalSteps: 10,
    isComplete: false,
    blockedAt: 'bc_fournisseur',
    ...partial,
  };
}

describe('fluxDashboard', () => {
  it('counts incomplete dossiers as alerts', () => {
    const list = [
      mockDossier({ id: '1', health: 'incomplete' }),
      mockDossier({ id: '2', health: 'complete', isComplete: true, missing_steps: [], missingDocumentLabels: [] }),
    ];
    const summary = computeFluxDashboardSummary(list);
    expect(summary.alertCount).toBe(1);
    expect(summary.incomplete).toBe(1);
    expect(summary.complete).toBe(1);
  });

  it('builds alert with client name and missing labels', () => {
    const alerts = buildFluxDashboardAlerts([mockDossier({})]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].partyName).toBe('Client Test');
    expect(alerts[0].partyKind).toBe('client');
    expect(alerts[0].missingLabels).toContain('BC fournisseur');
  });

  it('detects fournisseur alerts', () => {
    const alerts = buildFluxDashboardAlerts([
      mockDossier({
        client_name: null,
        fournisseur_name: 'Fournisseur XYZ',
        direction: 'achat',
      }),
    ]);
    expect(alerts[0].partyKind).toBe('fournisseur');
    expect(alerts[0].partyName).toBe('Fournisseur XYZ');
  });
});
