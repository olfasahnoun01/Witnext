import type { FluxDossierDetail } from '../types/dossierTypes';
import { FLUX_STEP_LABELS, FLUX_STEP_SHORT_CHIP, type FluxStepKey } from '../types/dossierTypes';

export interface FluxDashboardSummary {
  total: number;
  complete: number;
  inProgress: number;
  incomplete: number;
  alertCount: number;
}

export interface FluxDashboardAlert {
  dossierId: string;
  dossierNumber: string;
  partyName: string;
  partyKind: 'client' | 'fournisseur';
  direction: 'vente' | 'achat';
  bcReference: string | null;
  devisReference: string | null;
  health: FluxDossierDetail['health'];
  completionPercent: number;
  missingLabels: string[];
  missingChips: string[];
  nextActionLabel: string | null;
  blockedStepLabel: string | null;
}

export function computeFluxDashboardSummary(dossiers: FluxDossierDetail[]): FluxDashboardSummary {
  const active = dossiers.filter((d) => d.status !== 'cancelled');
  const complete = active.filter((d) => d.isComplete || d.health === 'complete').length;
  const incomplete = active.filter((d) => d.health === 'incomplete').length;
  const inProgress = active.filter(
    (d) => !d.isComplete && d.health !== 'complete' && d.health !== 'incomplete'
  ).length;

  return {
    total: active.length,
    complete,
    inProgress,
    incomplete,
    alertCount: buildFluxDashboardAlerts(active).length,
  };
}

export function buildFluxDashboardAlerts(dossiers: FluxDossierDetail[]): FluxDashboardAlert[] {
  return dossiers
    .filter((d) => d.status !== 'cancelled' && needsAttention(d))
    .map((d) => toAlert(d))
    .sort((a, b) => {
      if (a.health === 'incomplete' && b.health !== 'incomplete') return -1;
      if (b.health === 'incomplete' && a.health !== 'incomplete') return 1;
      return a.completionPercent - b.completionPercent;
    });
}

function needsAttention(d: FluxDossierDetail): boolean {
  if (d.isComplete || d.health === 'complete') return false;
  const missingSteps = d.missingSteps ?? d.missing_steps ?? [];
  const missingDocLabels = d.missingDocumentLabels ?? [];
  return (
    d.health === 'incomplete' ||
    missingSteps.length > 0 ||
    missingDocLabels.length > 0
  );
}

function toAlert(d: FluxDossierDetail): FluxDashboardAlert {
  const partyName = d.client_name ?? d.fournisseur_name ?? 'Sans nom';
  const partyKind: FluxDashboardAlert['partyKind'] =
    d.fournisseur_name && !d.client_name ? 'fournisseur' : 'client';

  const missingSteps = d.missingSteps ?? d.missing_steps ?? [];

  const missingLabels =
    (d.missingDocumentLabels?.length ?? 0) > 0
      ? d.missingDocumentLabels
      : missingSteps.map((k) => FLUX_STEP_LABELS[k as FluxStepKey]);

  return {
    dossierId: d.id,
    dossierNumber: d.dossier_number,
    partyName,
    partyKind,
    direction: d.direction,
    bcReference: d.bc_reference,
    devisReference: d.devis_reference,
    health: d.health,
    completionPercent: d.completion_percent,
    missingLabels: [...new Set(missingLabels)],
    missingChips: missingSteps.map((k) => FLUX_STEP_SHORT_CHIP[k as FluxStepKey]),
    nextActionLabel: d.next_action_label,
    blockedStepLabel: d.blockedAt ? FLUX_STEP_LABELS[d.blockedAt] : null,
  };
}
