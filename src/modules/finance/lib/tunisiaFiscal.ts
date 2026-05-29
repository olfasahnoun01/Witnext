/**
 * Paramètres fiscaux et comptables — République tunisienne (référence ERP).
 * Les montants sont en dinars tunisiens (DT), précision millimes (3 décimales).
 */

/** Timbre fiscal forfaitaire sur facture / acte (retenue à la source et facturation). */
export const TIMBRE_FISCAL_FACTURE_DT = 1.0;

/** Seuil TTC déclenchant l'obligation de retenue à la source (fournisseurs). */
export const SEUIL_RETENUE_SOURCE_TTC = 1000.0;

/**
 * FODEC — contribution sur vente de produits industriels (taux indicatif à valider selon NGP).
 * Applicable sur le HT de certaines lignes ; paramétrable par société.
 */
export const FODEC_TAUX_STANDARD = 1.0;

/** Comptes PCG tunisien — extraits utilisés par le module Finance. */
export const COMPTES_PCG = {
  clients: '411000',
  fournisseurs: '401000',
  ventes: '700000',
  achats: '607000',
  timbreFiscal: '431000',
  tvaCollectee19: '445710',
  tvaCollecteeAutre: '445799',
  tvaDeductible: '445620',
  banque: '512100',
  caisse: '531000',
  effetsAEncaisser: '514000',
} as const;

/** Délais de prescription / archivage indicatifs (jours) — à adapter selon votre politique. */
export const ARCHIVAGE_LEGAL_ANNEES = 10;
