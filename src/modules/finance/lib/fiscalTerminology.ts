/**
 * Terminologie comptable et fiscale tunisienne — libellés UI du module Finance.
 * Référence : PCG tunisien, déclaration mensuelle TVA, retenues à la source.
 */

export const FISCAL_LABELS = {
  // ——— TVA ———
  tvaCollectee: 'TVA Collectée',
  tvaDeductible: 'TVA Déductible',
  tvaNetteAPayer: 'TVA Nette à Payer',
  tvaDue: 'TVA Due',
  creditTva: 'Crédit de TVA',
  tvaFormule: 'TVA Nette à Payer = TVA Collectée − TVA Déductible',

  // ——— Chiffre d'affaires ———
  chiffreAffairesHt: "Chiffre d'Affaires HT",

  // ——— Autres taxes ———
  tclAPayer: 'TCL à Payer',
  timbresFiscauxAReverser: 'Timbres Fiscaux à Reverser',
  timbreFiscalFacture: 'Timbre fiscal (facture)',

  // ——— Retenues à la source ———
  retenueSourceClient: 'Retenue à la Source Client',
  retenuesClientsAEncaisser: 'Retenues Clients à Encaisser',
  attestationsRetenueClient: 'Attestations de Retenue Client',

  retenueSourceFournisseur: 'Retenue à la Source Fournisseur',
  retenuesFournisseursAReverser: 'Retenues Fournisseurs à Reverser',
  attestationsRetenueFournisseur: 'Attestations de Retenue Fournisseur',

  retenueSourceLoyers: 'Retenue à la Source sur Loyers',
  retenuesLoyersAReverser: 'Retenues sur Loyers à Reverser',

  // ——— Tableaux ———
  tableauDeBordFiscal: 'Tableau de Bord Fiscal',
  declarationMensuelleTva: 'Déclaration Mensuelle de TVA',

  // ——— Colonnes ———
  montantTva: 'Montant TVA',
  tauxTva: 'Taux TVA',
  baseHt: 'Base HT',
} as const;

/** Libellé du solde TVA selon le signe (crédit ou dû). */
export function labelSoldeTva(solde: number, estCredit: boolean): string {
  if (estCredit) return FISCAL_LABELS.creditTva;
  return FISCAL_LABELS.tvaNetteAPayer;
}

/** Texte complet du solde TVA pour notes / historique. */
export function formatSoldeTvaNote(solde: number, estCredit: boolean): string {
  const montant = Math.abs(solde).toFixed(3);
  if (estCredit) return `${FISCAL_LABELS.creditTva} : ${montant} DT`;
  return `${FISCAL_LABELS.tvaNetteAPayer} : ${montant} DT`;
}
