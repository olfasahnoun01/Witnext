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
