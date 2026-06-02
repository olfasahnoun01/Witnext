/** Six-step commercial chain tracked for CEO oversight. */
export type OperationStepKey =
  | 'devis_client'
  | 'bc_client'
  | 'bc_fournisseur'
  | 'facture_fournisseur'
  | 'bl_vente'
  | 'facture_client';

export type OperationStepStatus = 'missing' | 'draft' | 'in_progress' | 'done';

export type OperationDocModule = 'devis' | 'documents' | 'factures' | 'finance';

export interface OperationStepRef {
  module: OperationDocModule;
  id: string;
  numero: string;
  date?: string;
  status?: string;
  /** Raw row for PDF preview (devis row, document, facture, etc.) */
  previewPayload?: unknown;
}

export interface OperationStep {
  key: OperationStepKey;
  label: string;
  status: OperationStepStatus;
  ref?: OperationStepRef;
  /** Human hint when step is partial (e.g. BE received but no finance invoice). */
  hint?: string;
}

export interface CommercialOperation {
  bcClientId: number;
  clientName: string;
  bcNumero: string;
  devisClientNumero: string | null;
  createdAt: string;
  bcStatus: string;
  steps: OperationStep[];
  completionPercent: number;
  completedSteps: number;
  blockedAt?: OperationStepKey;
  isComplete: boolean;
}

export const OPERATION_STEP_ORDER: OperationStepKey[] = [
  'devis_client',
  'bc_client',
  'bc_fournisseur',
  'facture_fournisseur',
  'bl_vente',
  'facture_client',
];

export const OPERATION_STEP_LABELS: Record<OperationStepKey, string> = {
  devis_client: 'Devis client',
  bc_client: 'BC client',
  bc_fournisseur: 'BC fournisseur',
  facture_fournisseur: 'Facture fournisseur',
  bl_vente: 'BL vente',
  facture_client: 'Facture client',
};

export function stepStatusLabel(status: OperationStepStatus): string {
  switch (status) {
    case 'missing':
      return 'Manquant';
    case 'draft':
      return 'Brouillon';
    case 'in_progress':
      return 'En cours';
    case 'done':
      return 'OK';
  }
}

export function stepStatusBadgeClass(status: OperationStepStatus): string {
  switch (status) {
    case 'done':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300';
    case 'in_progress':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
    case 'draft':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300';
    case 'missing':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300';
  }
}
