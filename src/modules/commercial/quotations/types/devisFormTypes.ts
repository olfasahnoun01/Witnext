import type { ClientTvaStatus } from '@/config/sectionThemes';
import type { Devis, DevisItem } from '@/types';
import type { CommercialAttachmentRecord } from '@/lib/commercialAttachments';
import type { DevisFormCommitOptions } from '@/lib/devisTvaPolicy';

export interface DevisPartyFournisseur {
  id: number;
  nom: string;
  code?: string | null;
  matricule_fiscale: string | null;
  location: string | null;
  phone: string | null;
  patente_url?: string | null;
  registre_commerce_url?: string | null;
}

export interface DevisPartyClient {
  id: number;
  nom: string;
  code?: string | null;
  matricule_fiscale: string | null;
  location: string | null;
  phone: string | null;
  tva_status?: ClientTvaStatus | string | null;
}

export type DevisDocumentStatus =
  | 'brouillon'
  | 'envoyé'
  | 'accepté'
  | 'refusé'
  | 'confirmé'
  | 'reçu'
  | 'intégré';

export interface DevisFormProps {
  devisType: 'achat' | 'vente';
  devisNumber: string;
  devisDate: string;
  thirdPartyName: string;
  thirdPartyAddress: string;
  thirdPartyTaxId: string;
  thirdPartyPhone: string;
  notes: string;
  documentStatus: DevisDocumentStatus;
  devisItems: DevisItem[];
  editingDevis: Devis | null;
  isSaving: boolean;
  isTtc: boolean;
  isFodecEnabled: boolean;
  setDevisType: (t: 'achat' | 'vente') => void;
  setDevisNumber: (v: string) => void;
  setDevisDate: (v: string) => void;
  setThirdPartyName: (v: string) => void;
  setThirdPartyAddress: (v: string) => void;
  setThirdPartyTaxId: (v: string) => void;
  setThirdPartyPhone: (v: string) => void;
  setNotes: (v: string) => void;
  setDocumentStatus: (v: DevisDocumentStatus) => void;
  setDevisItems: React.Dispatch<React.SetStateAction<DevisItem[]>>;
  setIsTtc: (v: boolean) => void;
  setIsFodecEnabled: (v: boolean) => void;
  draftSavedAt?: string | null;
  onSave: (options?: DevisFormCommitOptions) => void;
  onUpdate: (options?: DevisFormCommitOptions) => void;
  onCancel: () => void;
  docType: 'devis' | 'bc' | 'ba';
  setDocType: (t: 'devis' | 'bc' | 'ba') => void;
  lockDevisType?: boolean;
  forceDocType?: 'devis' | 'bc';
  existingAttachments?: CommercialAttachmentRecord[];
  pendingAttachmentFiles?: File[];
  onPendingAttachmentFilesChange?: (files: File[]) => void;
  onRemoveExistingAttachment?: (index: number) => void;
  importableDevis?: Devis[];
  onImportDevis?: (selected: Devis[]) => void;
  onComposerDirtyChange?: (dirty: boolean) => void;
}
