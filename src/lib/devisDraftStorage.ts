import type { DevisItem } from '@/types';

export interface DevisFormDraft {
  devisType: 'achat' | 'vente';
  docType: 'devis' | 'bc' | 'ba';
  devisNumber: string;
  devisDate: string;
  thirdPartyName: string;
  thirdPartyAddress: string;
  thirdPartyTaxId: string;
  thirdPartyPhone: string;
  notes: string;
  documentStatus: string;
  devisItems: DevisItem[];
  isTtc: boolean;
  savedAt: string;
}

function draftKey(companyId: string | null, devisType: 'achat' | 'vente', docType: string): string {
  return `grosafe_devis_draft_${companyId ?? 'global'}_${devisType}_${docType}`;
}

export function loadDevisDraft(
  companyId: string | null,
  devisType: 'achat' | 'vente',
  docType: 'devis' | 'bc' | 'ba'
): DevisFormDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(companyId, devisType, docType));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DevisFormDraft;
    if (!parsed || !Array.isArray(parsed.devisItems)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDevisDraft(
  companyId: string | null,
  devisType: 'achat' | 'vente',
  docType: 'devis' | 'bc' | 'ba',
  draft: Omit<DevisFormDraft, 'savedAt'>
): void {
  try {
    const payload: DevisFormDraft = { ...draft, savedAt: new Date().toISOString() };
    localStorage.setItem(draftKey(companyId, devisType, docType), JSON.stringify(payload));
  } catch {
    // ignore quota
  }
}

export function clearDevisDraft(
  companyId: string | null,
  devisType: 'achat' | 'vente',
  docType: 'devis' | 'bc' | 'ba'
): void {
  try {
    localStorage.removeItem(draftKey(companyId, devisType, docType));
  } catch {
    // ignore
  }
}
