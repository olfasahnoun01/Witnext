const ACTIVE_TAB_KEY = 'grosafe_active_tab';

export function readStoredActiveTab(fallback = 'dashboard'): string {
  try {
    const stored = localStorage.getItem(ACTIVE_TAB_KEY);
    return stored?.trim() ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredActiveTab(tabId: string): void {
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tabId);
  } catch {
    // ignore quota / private mode
  }
}

export function devisSectionStorageKey(
  sectionMode: 'devis' | 'bc' | 'bl' | undefined,
  devisType: 'achat' | 'vente'
): string {
  return `grosafe_devis_section_${sectionMode ?? 'devis'}_${devisType}`;
}

export function readStoredDevisSection(
  sectionMode: 'devis' | 'bc' | 'bl' | undefined,
  devisType: 'achat' | 'vente',
  fallback: 'form' | 'history' | 'bc' | 'bl' | 'helper'
): typeof fallback {
  try {
    const raw = localStorage.getItem(devisSectionStorageKey(sectionMode, devisType));
    if (
      raw === 'form' ||
      raw === 'history' ||
      raw === 'bc' ||
      raw === 'bl' ||
      raw === 'helper'
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export function writeStoredDevisSection(
  sectionMode: 'devis' | 'bc' | 'bl' | undefined,
  devisType: 'achat' | 'vente',
  section: string
): void {
  try {
    localStorage.setItem(devisSectionStorageKey(sectionMode, devisType), section);
  } catch {
    // ignore
  }
}

const PENDING_WAREHOUSE_DOC_KEY = 'grosafe_pending_warehouse_doc';

export interface PendingWarehouseDocument {
  companyId: string;
  type: 'BE' | 'BS';
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  date: string;
  note?: string;
  transactionId?: number;
}

export function writePendingWarehouseDocument(data: PendingWarehouseDocument): void {
  try {
    localStorage.setItem(PENDING_WAREHOUSE_DOC_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function readPendingWarehouseDocument(expectedCompanyId?: string | null): PendingWarehouseDocument | null {
  try {
    const raw = localStorage.getItem(PENDING_WAREHOUSE_DOC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingWarehouseDocument;
    if (
      (parsed.type !== 'BE' && parsed.type !== 'BS') ||
      typeof parsed.productId !== 'number' ||
      typeof parsed.quantity !== 'number' ||
      typeof parsed.companyId !== 'string'
    ) {
      return null;
    }
    if (expectedCompanyId && parsed.companyId !== expectedCompanyId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingWarehouseDocument(): void {
  try {
    localStorage.removeItem(PENDING_WAREHOUSE_DOC_KEY);
  } catch {
    // ignore
  }
}
