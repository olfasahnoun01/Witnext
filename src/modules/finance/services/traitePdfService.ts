/**
 * Construction des données traite pour impression PDF.
 */

import { supabase } from '@/integrations/supabase/client';
import type { FinanceCompanyRow } from '../types';
import type { CounterpartyOption, SettlementDirection } from '../types/paymentTypes';
import type { TraitePdfData } from '../lib/traitePdf';
import { parsePaymentMeta } from './paymentService';
import type { PaymentRow } from '../types';
import { loadTreasuryAccounts } from './treasuryStorage';

const COMPANY_DISPLAY: Record<string, { legalName: string; city: string }> = {
  grosafe: { legalName: 'GROSAFE ÉQUIPEMENT', city: 'Tunis' },
  granisafe: { legalName: 'GRANISAFE', city: 'Tunis' },
  safe_team: { legalName: 'SAFE TEAM', city: 'Tunis' },
};

function companyParty(company: FinanceCompanyRow): TraitePdfData['tireur'] {
  const meta = COMPANY_DISPLAY[company.code] ?? { legalName: company.name, city: 'Tunis' };
  return { nom: meta.legalName, adresse: meta.city };
}

function counterpartyParty(c: CounterpartyOption): TraitePdfData['tire'] {
  return {
    nom: c.raisonSociale,
    matriculeFiscal: c.matriculeFiscal,
    adresse: c.adresse ?? null,
  };
}

export interface BuildTraiteFromFormInput {
  company: FinanceCompanyRow;
  direction: SettlementDirection;
  counterparty: CounterpartyOption;
  numeroPiece: string;
  pieceNumero: string;
  montant: number;
  paymentDate: string;
  dateEcheance: string;
  banque: string;
  treasuryAccountId?: string;
  companyId: string;
  invoiceReferences?: string[];
  notes?: string;
}

/** Données traite depuis le formulaire de règlement (aperçu avant enregistrement). */
export function buildTraiteDataFromForm(input: BuildTraiteFromFormInput): TraitePdfData {
  const tireur = companyParty(input.company);
  const tiers = counterpartyParty(input.counterparty);
  const accounts = loadTreasuryAccounts(input.companyId);
  const treasury = accounts.find((a) => a.id === input.treasuryAccountId);
  const rib = treasury?.rib ?? null;
  const lieu = COMPANY_DISPLAY[input.company.code]?.city ?? 'Tunis';

  const valeurEn =
    input.invoiceReferences?.length
      ? input.invoiceReferences.join(', ')
      : input.notes?.trim() || null;

  if (input.direction === 'client') {
    return {
      numero: input.pieceNumero || input.numeroPiece,
      montant: input.montant,
      dateCreation: input.paymentDate,
      lieuCreation: lieu,
      dateEcheance: input.dateEcheance,
      lieuPaiement: lieu,
      tireur,
      tire: tiers,
      beneficiaire: tireur,
      banque: input.banque,
      rib,
      valeurEn,
      aOrdre: true,
    };
  }

  return {
    numero: input.pieceNumero || input.numeroPiece,
    montant: input.montant,
    dateCreation: input.paymentDate,
    lieuCreation: lieu,
    dateEcheance: input.dateEcheance,
    lieuPaiement: lieu,
    tireur,
    tire: tireur,
    beneficiaire: tiers,
    banque: input.banque || treasury?.banqueLabel,
    rib,
    valeurEn,
    aOrdre: true,
  };
}

/** Charge un paiement enregistré et produit les données traite. */
export async function buildTraiteDataFromPaymentId(
  paymentId: string,
  company: FinanceCompanyRow
): Promise<TraitePdfData> {
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (error || !payment) throw new Error('Paiement introuvable');

  const row = payment as PaymentRow;
  const meta = parsePaymentMeta(row.notes);
  if (!meta || meta.modeReglement !== 'TRAITE') {
    throw new Error("Ce règlement n'est pas une traite.");
  }

  let counterparty: CounterpartyOption = {
    id: meta.counterpartyId ?? 0,
    label: row.counterparty_name ?? '—',
    raisonSociale: row.counterparty_name ?? '—',
    matriculeFiscal: null,
  };

  if (meta.counterpartyId && meta.counterpartyType) {
    const table = meta.counterpartyType === 'client' ? 'clients' : 'fournisseurs';
    const { data: tier } = await supabase
      .from(table)
      .select('id, nom, matricule_fiscale, location')
      .eq('id', meta.counterpartyId)
      .maybeSingle();
    if (tier) {
      counterparty = {
        id: tier.id,
        label: tier.nom,
        raisonSociale: tier.nom,
        matriculeFiscal: tier.matricule_fiscale,
        adresse: tier.location,
      };
    }
  }

  const direction: SettlementDirection =
    row.direction === 'inbound_client' ? 'client' : 'fournisseur';

  const { data: allocations } = await supabase
    .from('payment_invoice_allocations')
    .select('invoice_id')
    .eq('payment_id', paymentId);

  const invoiceIds = (allocations ?? []).map((a) => a.invoice_id).filter(Boolean);
  let invoiceRefs: string[] = [];
  if (invoiceIds.length > 0) {
    const { data: invs } = await supabase.from('invoices').select('numero').in('id', invoiceIds);
    invoiceRefs = (invs ?? []).map((i) => i.numero);
  }

  return buildTraiteDataFromForm({
    company,
    companyId: row.company_id,
    direction,
    counterparty,
    numeroPiece: meta.numeroPiece,
    pieceNumero: meta.pieceNumero ?? row.reference ?? meta.numeroPiece,
    montant: Number(row.amount),
    paymentDate: row.payment_date,
    dateEcheance: meta.dateEcheance ?? row.payment_date,
    banque: meta.banque ?? '',
    treasuryAccountId: meta.treasuryAccountId,
    invoiceReferences: invoiceRefs,
    notes: row.notes ?? undefined,
  });
}

export { openTraitePdfPrint, downloadTraitePdf } from '../lib/traitePdf';
