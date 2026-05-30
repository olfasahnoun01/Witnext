import {
  SEUIL_RETENUE_SOURCE_TTC,
  TIMBRE_FISCAL_FACTURE_DT,
} from './tunisiaFiscal';

/** Timbre fiscal tunisien (assiette RS et facturation). */
export const TIMBRE_FISCAL_DT = TIMBRE_FISCAL_FACTURE_DT;

export { SEUIL_RETENUE_SOURCE_TTC };

/** Banques tunisiennes courantes (sélecteur chèques / traites). */
export const BANQUES_TUNISIE = [
  'BIAT',
  'Attijari bank',
  'UIB',
  'BH Bank',
  'Amen Bank',
  'BNA',
  'STB',
  'BTK',
  'UBCI',
  'ABC Bank',
  'Zitouna Bank',
  'Wifak Bank',
  'Al Baraka',
  'QNB',
  'Autre',
] as const;

export type BanqueTunisie = (typeof BANQUES_TUNISIE)[number];

/** Taux de retenue à la source (régime tunisien). */
export const TAUX_RETENUE_SOURCE = [
  { value: 1, label: '1 % — Achats courants' },
  { value: 1.5, label: '1,5 % — Personne physique' },
  { value: 3, label: '3 % — Honoraires régime réel' },
  { value: 10, label: '10 % — Loyer' },
] as const;

/** Types de frais bancaires prédéfinis. */
export const FRAIS_BANCAIRES_TYPES = [
  { id: 'commission', label: 'Commission bancaire' },
  { id: 'interet_crediteur', label: 'Intérêt créditeur' },
  { id: 'interet_debiteur', label: 'Intérêt débiteur' },
  { id: 'agios', label: 'Agios' },
  { id: 'autre', label: 'Autre frais' },
] as const;

export type FraisBancaireTypeId = (typeof FRAIS_BANCAIRES_TYPES)[number]['id'] | string;

export type TauxRetenueSource = (typeof TAUX_RETENUE_SOURCE)[number]['value'];
