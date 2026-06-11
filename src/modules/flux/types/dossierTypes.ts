/** End-to-end commercial flux step keys */
export type FluxStepKey =
  | 'confirmation'
  | 'devis_client'
  | 'bc_client'
  | 'achat_demande'
  | 'devis_fournisseur'
  | 'bc_fournisseur'
  | 'reception_stock'
  | 'facture_fournisseur'
  | 'preparation'
  | 'sortie_stock'
  | 'bl_vente'
  | 'livraison_confirmee'
  | 'facture_client';

export type FluxStepStatus = 'missing' | 'draft' | 'in_progress' | 'done' | 'skipped';

export type FluxDocModule = 'devis' | 'documents' | 'factures' | 'finance' | 'checkpoint';

export type DossierHealth = 'complete' | 'in_progress' | 'incomplete';

export type DossierStatus = 'active' | 'blocked' | 'completed' | 'cancelled';

export type FluxListTab = 'en_cours' | 'termines' | 'incomplets';

export type AssignedRole = 'commercial' | 'achats' | 'magasin' | 'finance';

export interface FluxStepRef {
  module: FluxDocModule;
  id: string;
  numero: string;
  date?: string;
  status?: string;
  previewPayload?: unknown;
}

export interface FluxStep {
  key: FluxStepKey;
  label: string;
  status: FluxStepStatus;
  owner: AssignedRole;
  ref?: FluxStepRef;
  hint?: string;
}

export interface CommercialDossierRow {
  id: string;
  company_id: string;
  dossier_number: string;
  direction: 'vente' | 'achat';
  status: DossierStatus;
  client_id: number | null;
  fournisseur_id: number | null;
  client_name: string | null;
  fournisseur_name: string | null;
  anchor_devis_id: number | null;
  anchor_bc_devis_id: number | null;
  anchor_document_id: string | null;
  bc_reference: string | null;
  devis_reference: string | null;
  assigned_user_id: string | null;
  assigned_role: AssignedRole | null;
  current_step: FluxStepKey | null;
  health: DossierHealth;
  missing_steps: FluxStepKey[];
  completion_percent: number;
  next_action_label: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface FluxDossierDetail extends CommercialDossierRow {
  steps: FluxStep[];
  missingDocumentLabels: string[];
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
  blockedAt?: FluxStepKey;
}

export interface DossierEventRow {
  id: string;
  dossier_id: string;
  event_type: 'step_change' | 'note' | 'assignment' | 'action' | 'notification';
  step_key: string | null;
  message: string;
  payload: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface DossierCheckpointRow {
  id: string;
  dossier_id: string;
  step_key: FluxStepKey;
  status: 'done' | 'skipped';
  completed_at: string;
  completed_by: string | null;
  notes: string | null;
}

export const FLUX_STEP_ORDER: FluxStepKey[] = [
  'confirmation',
  'devis_client',
  'bc_client',
  'achat_demande',
  'devis_fournisseur',
  'bc_fournisseur',
  'reception_stock',
  'facture_fournisseur',
  'preparation',
  'sortie_stock',
  'bl_vente',
  'livraison_confirmee',
  'facture_client',
];

/** Steps that block "complete" health when missing */
export const FLUX_REQUIRED_STEPS: FluxStepKey[] = [
  'bc_client',
  'bc_fournisseur',
  'reception_stock',
  'bl_vente',
  'facture_client',
];

export const FLUX_STEP_LABELS: Record<FluxStepKey, string> = {
  confirmation: 'Confirmation client',
  devis_client: 'Devis client',
  bc_client: 'BC client',
  achat_demande: "Demande d'achat",
  devis_fournisseur: 'Devis fournisseur',
  bc_fournisseur: 'BC fournisseur',
  reception_stock: 'Réception stock (BE)',
  facture_fournisseur: 'Facture fournisseur',
  preparation: 'Préparation articles',
  sortie_stock: 'Sortie stock (BS)',
  bl_vente: 'BL / livraison',
  livraison_confirmee: 'Reçu client',
  facture_client: 'Facture client',
};

export const FLUX_STEP_SHORT_CHIP: Record<FluxStepKey, string> = {
  confirmation: 'Confirmation',
  devis_client: 'Devis',
  bc_client: 'BC',
  achat_demande: 'Demande achat',
  devis_fournisseur: 'Devis fr.',
  bc_fournisseur: 'BC fr.',
  reception_stock: 'BE',
  facture_fournisseur: 'Fact. fr.',
  preparation: 'Préparation',
  sortie_stock: 'BS',
  bl_vente: 'BL',
  livraison_confirmee: 'Reçu',
  facture_client: 'Facture',
};

export const FLUX_STEP_OWNER: Record<FluxStepKey, AssignedRole> = {
  confirmation: 'commercial',
  devis_client: 'commercial',
  bc_client: 'commercial',
  achat_demande: 'achats',
  devis_fournisseur: 'achats',
  bc_fournisseur: 'achats',
  reception_stock: 'magasin',
  facture_fournisseur: 'finance',
  preparation: 'magasin',
  sortie_stock: 'magasin',
  bl_vente: 'magasin',
  livraison_confirmee: 'commercial',
  facture_client: 'finance',
};

export function fluxStepStatusLabel(status: FluxStepStatus): string {
  switch (status) {
    case 'missing':
      return 'Manquant';
    case 'draft':
      return 'Brouillon';
    case 'in_progress':
      return 'En cours';
    case 'done':
      return 'OK';
    case 'skipped':
      return '—';
  }
}

export function fluxHealthLabel(health: DossierHealth): string {
  switch (health) {
    case 'complete':
      return 'Terminé';
    case 'in_progress':
      return 'En cours';
    case 'incomplete':
      return 'Incomplet';
  }
}

export function listTabForHealth(health: DossierHealth, isComplete: boolean): FluxListTab {
  if (isComplete || health === 'complete') return 'termines';
  if (health === 'incomplete') return 'incomplets';
  return 'en_cours';
}
