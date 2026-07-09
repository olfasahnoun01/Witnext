import type { DevisFormCommitOptions } from '@/lib/devisTvaPolicy';
import type { CommercialAttachmentRecord } from '@/lib/commercialAttachments';
import type { Devis, DevisItem } from '@/types';
import type { DevisDocumentStatus } from '@/modules/commercial/quotations/types/devisFormTypes';

export type PersistNewDevisInput = {
  devisNumber: string;
  devisType: 'achat' | 'vente';
  devisDate: string;
  thirdPartyName: string;
  thirdPartyAddress: string;
  thirdPartyTaxId: string;
  thirdPartyPhone: string;
  notes: string;
  devisItems: DevisItem[];
  isTtc: boolean;
  isFodecEnabled: boolean;
  docType: 'devis' | 'bc' | 'ba';
  saveAsBc: boolean;
  documentStatus: DevisDocumentStatus;
  existingAttachments: CommercialAttachmentRecord[];
  pendingAttachmentFiles: File[];
  importSourceDevisIds: number[];
  commit?: DevisFormCommitOptions;
};

export type PersistNewDevisResult =
  | {
      ok: true;
      devisNumber: string;
      saveAsBc: boolean;
      attachmentUrls: CommercialAttachmentRecord[];
      companyId: string;
    }
  | {
      ok: false;
      reason: 'duplicate_number' | 'save_failed';
      message: string;
    };

export type PersistDevisUpdateInput = {
  editingDevis: Devis;
  devisNumber: string;
  devisType: 'achat' | 'vente';
  devisDate: string;
  thirdPartyName: string;
  thirdPartyAddress: string;
  thirdPartyTaxId: string;
  thirdPartyPhone: string;
  notes: string;
  devisItems: DevisItem[];
  isTtc: boolean;
  isFodecEnabled: boolean;
  docType: 'devis' | 'bc' | 'ba';
  documentStatus: DevisDocumentStatus;
  existingAttachments: CommercialAttachmentRecord[];
  pendingAttachmentFiles: File[];
  commit?: DevisFormCommitOptions;
};

export type PersistDevisUpdateResult =
  | { ok: true; attachmentUrls: CommercialAttachmentRecord[] }
  | { ok: false; reason: 'session_expired' | 'update_failed'; message: string };

export type CreateBcFromSourcesInput = {
  sources: Devis[];
  modifiedItems: DevisItem[];
  bcStatus: DevisDocumentStatus;
};

export type CreateBcFromSourcesResult =
  | { ok: true; bcNumber: string; insertedBcId: number }
  | { ok: false; message: string };
