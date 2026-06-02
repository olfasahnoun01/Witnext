/** Statut TVA d'un client (Tunisie). */
export type ClientTvaStatus = 'assujetti' | 'exonere';

export const CLIENT_TVA_STATUS_OPTIONS: Array<{ value: ClientTvaStatus; label: string }> = [
  { value: 'assujetti', label: 'Assujetti à la TVA' },
  { value: 'exonere', label: 'Exonéré de TVA' },
];

export function clientTvaStatusLabel(status: ClientTvaStatus | string | null | undefined): string {
  return CLIENT_TVA_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? '—';
}

/**
 * Per-module accent colors for the main sidebar (section headers + active items).
 * Each ERP domain gets a distinct hue so users can orient quickly.
 */
export interface SectionTheme {
  headerExpanded: string;
  headerCollapsed: string;
  iconExpanded: string;
  iconCollapsed: string;
  treeBorder: string;
  subActive: string;
  subInactive: string;
}

export const SECTION_THEMES: Record<string, SectionTheme> = {
  ventes: {
    headerExpanded: 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 border-emerald-500/35',
    headerCollapsed: 'text-emerald-950/80 dark:text-emerald-100/70 hover:bg-emerald-500/10',
    iconExpanded: 'bg-emerald-600 text-white',
    iconCollapsed: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    treeBorder: 'border-emerald-500/30',
    subActive: 'bg-emerald-600 text-white shadow-md',
    subInactive: 'text-sidebar-foreground hover:bg-emerald-500/10 hover:text-emerald-900 dark:hover:text-emerald-100',
  },
  achats: {
    headerExpanded: 'bg-orange-500/15 text-orange-950 dark:text-orange-100 border-orange-500/35',
    headerCollapsed: 'text-orange-950/80 dark:text-orange-100/70 hover:bg-orange-500/10',
    iconExpanded: 'bg-orange-600 text-white',
    iconCollapsed: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
    treeBorder: 'border-orange-500/30',
    subActive: 'bg-orange-600 text-white shadow-md',
    subInactive: 'text-sidebar-foreground hover:bg-orange-500/10 hover:text-orange-950 dark:hover:text-orange-100',
  },
  magasin: {
    headerExpanded: 'bg-sky-500/15 text-sky-950 dark:text-sky-100 border-sky-500/35',
    headerCollapsed: 'text-sky-950/80 dark:text-sky-100/70 hover:bg-sky-500/10',
    iconExpanded: 'bg-sky-600 text-white',
    iconCollapsed: 'bg-sky-500/20 text-sky-700 dark:text-sky-300',
    treeBorder: 'border-sky-500/30',
    subActive: 'bg-sky-600 text-white shadow-md',
    subInactive: 'text-sidebar-foreground hover:bg-sky-500/10 hover:text-sky-950 dark:hover:text-sky-100',
  },
  rh: {
    headerExpanded: 'bg-violet-500/15 text-violet-950 dark:text-violet-100 border-violet-500/35',
    headerCollapsed: 'text-violet-950/80 dark:text-violet-100/70 hover:bg-violet-500/10',
    iconExpanded: 'bg-violet-600 text-white',
    iconCollapsed: 'bg-violet-500/20 text-violet-700 dark:text-violet-300',
    treeBorder: 'border-violet-500/30',
    subActive: 'bg-violet-600 text-white shadow-md',
    subInactive: 'text-sidebar-foreground hover:bg-violet-500/10 hover:text-violet-950 dark:hover:text-violet-100',
  },
  finance: {
    headerExpanded: 'bg-amber-500/15 text-amber-950 dark:text-amber-100 border-amber-500/35',
    headerCollapsed: 'text-amber-950/80 dark:text-amber-100/70 hover:bg-amber-500/10',
    iconExpanded: 'bg-amber-600 text-white',
    iconCollapsed: 'bg-amber-500/20 text-amber-800 dark:text-amber-300',
    treeBorder: 'border-amber-500/30',
    subActive: 'bg-amber-600 text-white shadow-md',
    subInactive: 'text-sidebar-foreground hover:bg-amber-500/10 hover:text-amber-950 dark:hover:text-amber-100',
  },
  vehicules: {
    headerExpanded: 'bg-teal-500/15 text-teal-950 dark:text-teal-100 border-teal-500/35',
    headerCollapsed: 'text-teal-950/80 dark:text-teal-100/70 hover:bg-teal-500/10',
    iconExpanded: 'bg-teal-600 text-white',
    iconCollapsed: 'bg-teal-500/20 text-teal-700 dark:text-teal-300',
    treeBorder: 'border-teal-500/30',
    subActive: 'bg-teal-600 text-white shadow-md',
    subInactive: 'text-sidebar-foreground hover:bg-teal-500/10 hover:text-teal-950 dark:hover:text-teal-100',
  },
  administration: {
    headerExpanded: 'bg-slate-500/15 text-slate-900 dark:text-slate-100 border-slate-500/35',
    headerCollapsed: 'text-slate-900/80 dark:text-slate-100/70 hover:bg-slate-500/10',
    iconExpanded: 'bg-slate-600 text-white',
    iconCollapsed: 'bg-slate-500/20 text-slate-700 dark:text-slate-300',
    treeBorder: 'border-slate-500/30',
    subActive: 'bg-slate-600 text-white shadow-md',
    subInactive: 'text-sidebar-foreground hover:bg-slate-500/10',
  },
};

export const DEFAULT_SECTION_THEME: SectionTheme = SECTION_THEMES.administration;

export function getSectionTheme(sectionId: string): SectionTheme {
  return SECTION_THEMES[sectionId] ?? DEFAULT_SECTION_THEME;
}
