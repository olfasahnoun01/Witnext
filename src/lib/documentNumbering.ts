import { supabase } from '@/integrations/supabase/client';
import { requireActiveCompanyId } from '@/lib/activeCompany';

/** Prefix used in documents.numero for each unified document type. */
export const DOCUMENT_NUMBER_PREFIX: Record<string, string> = {
  DEMANDE_ACHAT: 'DA',
  BC_CLIENT: 'BCC',
  DEVIS_FOURNISSEUR: 'DF',
  BC_FOURNISSEUR: 'BCF',
  BL_FOURNISSEUR: 'BLF',
  BE: 'BE',
  BS: 'BS',
  BL_CLIENT: 'BLC',
  FACTURE: 'FACT',
};

/**
 * Next number from existing PREFIX-YEAR-SEQ values (max seq + 1).
 * Exported for tests — prefer {@link allocateDocumentNumber} in production.
 */
export function nextDocumentNumberFromExisting(
  prefix: string,
  year: number,
  existingNumbers: string[]
): string {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
  let maxNum = 0;
  for (const raw of existingNumbers) {
    const m = String(raw).trim().match(re);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  const next = maxNum + 1;
  const pad = next >= 1000 ? String(next).length : 3;
  return `${prefix}-${year}-${String(next).padStart(pad, '0')}`;
}

async function fetchExistingDocumentNumbers(
  companyId: string,
  prefix: string,
  year: number
): Promise<string[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('numero')
    .ilike('numero', `${prefix}-${year}-%`)
    .or(`company_id.eq.${companyId},company_id.is.null`);

  if (error) throw error;
  return (data ?? []).map((row) => String((row as { numero: string }).numero));
}

function numberAlreadyTaken(candidate: string, existing: string[]): boolean {
  const target = candidate.trim().toLowerCase();
  return existing.some((n) => String(n).trim().toLowerCase() === target);
}

/** Client-side max+1 fallback when the DB RPC is missing. */
export async function fetchNextDocumentNumberFromDb(
  prefix: string,
  year: number = new Date().getFullYear()
): Promise<string> {
  const companyId = requireActiveCompanyId();
  const existing = await fetchExistingDocumentNumbers(companyId, prefix, year);
  return nextDocumentNumberFromExisting(prefix, year, existing);
}

/**
 * Atomically allocate the next unified-document number (per company + prefix + year).
 * Falls back to a max-query if the RPC is not deployed yet.
 */
export async function allocateDocumentNumber(
  type: string,
  year: number = new Date().getFullYear()
): Promise<string> {
  const prefix = DOCUMENT_NUMBER_PREFIX[type];
  if (!prefix) {
    throw new Error(`Préfixe de numérotation inconnu pour le type: ${type}`);
  }

  const companyId = requireActiveCompanyId();

  const { data, error } = await supabase.rpc('allocate_document_number', {
    p_company_id: companyId,
    p_prefix: prefix,
    p_year: year,
  });

  if (!error && typeof data === 'string' && data.length > 0) {
    try {
      const existing = await fetchExistingDocumentNumbers(companyId, prefix, year);
      if (!numberAlreadyTaken(data, existing)) {
        return data;
      }
      console.warn(
        `[documentNumbering] RPC returned ${data} which already exists; using max+1 fallback`
      );
      return nextDocumentNumberFromExisting(prefix, year, existing);
    } catch (verifyErr) {
      console.warn('[documentNumbering] could not verify RPC number, using it anyway:', verifyErr);
      return data;
    }
  }

  if (error && !/allocate_document_number|schema cache|function/i.test(error.message)) {
    console.warn('[documentNumbering] RPC failed, using fallback:', error.message);
  }

  return fetchNextDocumentNumberFromDb(prefix, year);
}

export function isDocumentNumeroUniqueViolation(error: {
  code?: string;
  message?: string;
} | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('duplicate key') && msg.includes('numero');
}
