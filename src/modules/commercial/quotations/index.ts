export { parseDevisRow } from '@/modules/commercial/quotations/lib/parseDevisRow';
export { partyPhoneToLines, parsePartyAddressFields } from '@/modules/commercial/quotations/lib/devisPartyUtils';
export {
  DEVIS_DEFAULT_CATEGORIES,
  DEVIS_ARTICLE_SIZES,
  DEVIS_ARTICLE_COLORS,
} from '@/modules/commercial/quotations/lib/devisFormConstants';
export type {
  DevisFormProps,
  DevisPartyClient,
  DevisPartyFournisseur,
  DevisDocumentStatus,
} from '@/modules/commercial/quotations/types/devisFormTypes';
export type {
  CreateBcFromSourcesInput,
  CreateBcFromSourcesResult,
  PersistDevisUpdateInput,
  PersistDevisUpdateResult,
  PersistNewDevisInput,
  PersistNewDevisResult,
} from '@/modules/commercial/quotations/types/devisPersistenceTypes';
export { useDevisDocumentList } from '@/modules/commercial/quotations/hooks/useDevisDocumentList';
export { useDevisParties } from '@/modules/commercial/quotations/hooks/useDevisParties';
export { useDevisCatalogSearch } from '@/modules/commercial/quotations/hooks/useDevisCatalogSearch';
export { useDevisPersistence } from '@/modules/commercial/quotations/hooks/useDevisPersistence';
export { useDevisNewPartyDialogs } from '@/modules/commercial/quotations/hooks/useDevisNewPartyDialogs';
export { useDevisArticleDialogs } from '@/modules/commercial/quotations/hooks/useDevisArticleDialogs';
export { DevisFormDialogs } from '@/modules/commercial/quotations/components/DevisFormDialogs';
export { DevisFormArticlesSection } from '@/modules/commercial/quotations/components/DevisFormArticlesSection';
export { DevisFormNotesSection } from '@/modules/commercial/quotations/components/DevisFormNotesSection';
export { DevisFormSettingsHeader } from '@/modules/commercial/quotations/components/DevisFormSettingsHeader';
export {
  confirmDevisRecord,
  deleteDevisRecord,
  deleteSuccessMessage,
  insertDevisRecord,
  patchDevisAttachments,
  updateDevisRecord,
} from '@/modules/commercial/quotations/services/devisRepository';
export {
  createBcFromDevisSources,
  persistDevisUpdate,
  persistNewDevis,
} from '@/modules/commercial/quotations/services/devisPersistenceService';
