import type { FinanceMainSectionId } from './financeNavigation';

export interface FinanceSectionTheme {
  mainTabActive: string;
  mainTabInactive: string;
  titleColor: string;
  accentBar: string;
  headerShell: string;
  subNavShell: string;
  subTabActive: string;
  subTabInactive: string;
  workArea: string;
  activeSubStrip: string;
}

const THEMES: Record<FinanceMainSectionId, FinanceSectionTheme> = {
  overview: {
    mainTabActive:
      'data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-amber-700/30 data-[state=active]:font-semibold',
    mainTabInactive: 'text-amber-900/70 dark:text-amber-100/70 hover:bg-amber-500/10 border-transparent',
    titleColor: 'text-amber-900 dark:text-amber-100',
    accentBar: 'bg-amber-500',
    headerShell: 'border-amber-500/30 bg-amber-500/5',
    subNavShell: 'border-amber-500/25 bg-amber-500/[0.03]',
    subTabActive:
      'data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:border-amber-700/40 data-[state=active]:shadow-sm data-[state=active]:font-semibold',
    subTabInactive: 'text-muted-foreground hover:bg-amber-500/10 hover:text-amber-950 dark:hover:text-amber-50 border-transparent',
    workArea: 'border-amber-500/25 border-t-[3px] border-t-amber-500 bg-card',
    activeSubStrip: 'bg-amber-500/10 border-amber-500/20 text-amber-950 dark:text-amber-100',
  },
  sources: {
    mainTabActive:
      'data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-sky-700/30 data-[state=active]:font-semibold',
    mainTabInactive: 'text-sky-900/70 dark:text-sky-100/70 hover:bg-sky-500/10 border-transparent',
    titleColor: 'text-sky-900 dark:text-sky-100',
    accentBar: 'bg-sky-500',
    headerShell: 'border-sky-500/30 bg-sky-500/5',
    subNavShell: 'border-sky-500/25 bg-sky-500/[0.03]',
    subTabActive:
      'data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:border-sky-700/40 data-[state=active]:shadow-sm data-[state=active]:font-semibold',
    subTabInactive: 'text-muted-foreground hover:bg-sky-500/10 hover:text-sky-950 dark:hover:text-sky-50 border-transparent',
    workArea: 'border-sky-500/25 border-t-[3px] border-t-sky-500 bg-card',
    activeSubStrip: 'bg-sky-500/10 border-sky-500/20 text-sky-950 dark:text-sky-100',
  },
  billing: {
    mainTabActive:
      'data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-emerald-700/30 data-[state=active]:font-semibold',
    mainTabInactive: 'text-emerald-900/70 dark:text-emerald-100/70 hover:bg-emerald-500/10 border-transparent',
    titleColor: 'text-emerald-900 dark:text-emerald-100',
    accentBar: 'bg-emerald-500',
    headerShell: 'border-emerald-500/30 bg-emerald-500/5',
    subNavShell: 'border-emerald-500/25 bg-emerald-500/[0.03]',
    subTabActive:
      'data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:border-emerald-700/40 data-[state=active]:shadow-sm data-[state=active]:font-semibold',
    subTabInactive: 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-950 dark:hover:text-emerald-50 border-transparent',
    workArea: 'border-emerald-500/25 border-t-[3px] border-t-emerald-500 bg-card',
    activeSubStrip: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-100',
  },
  settlements: {
    mainTabActive:
      'data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-indigo-700/30 data-[state=active]:font-semibold',
    mainTabInactive: 'text-indigo-900/70 dark:text-indigo-100/70 hover:bg-indigo-500/10 border-transparent',
    titleColor: 'text-indigo-900 dark:text-indigo-100',
    accentBar: 'bg-indigo-500',
    headerShell: 'border-indigo-500/30 bg-indigo-500/5',
    subNavShell: 'border-indigo-500/25 bg-indigo-500/[0.03]',
    subTabActive:
      'data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:border-indigo-700/40 data-[state=active]:shadow-sm data-[state=active]:font-semibold',
    subTabInactive: 'text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-950 dark:hover:text-indigo-50 border-transparent',
    workArea: 'border-indigo-500/25 border-t-[3px] border-t-indigo-500 bg-card',
    activeSubStrip: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-950 dark:text-indigo-100',
  },
  treasury: {
    mainTabActive:
      'data-[state=active]:bg-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-cyan-700/30 data-[state=active]:font-semibold',
    mainTabInactive: 'text-cyan-900/70 dark:text-cyan-100/70 hover:bg-cyan-500/10 border-transparent',
    titleColor: 'text-cyan-900 dark:text-cyan-100',
    accentBar: 'bg-cyan-500',
    headerShell: 'border-cyan-500/30 bg-cyan-500/5',
    subNavShell: 'border-cyan-500/25 bg-cyan-500/[0.03]',
    subTabActive:
      'data-[state=active]:bg-cyan-600 data-[state=active]:text-white data-[state=active]:border-cyan-700/40 data-[state=active]:shadow-sm data-[state=active]:font-semibold',
    subTabInactive: 'text-muted-foreground hover:bg-cyan-500/10 hover:text-cyan-950 dark:hover:text-cyan-50 border-transparent',
    workArea: 'border-cyan-500/25 border-t-[3px] border-t-cyan-500 bg-card',
    activeSubStrip: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-950 dark:text-cyan-100',
  },
  fiscal: {
    mainTabActive:
      'data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-violet-700/30 data-[state=active]:font-semibold',
    mainTabInactive: 'text-violet-900/70 dark:text-violet-100/70 hover:bg-violet-500/10 border-transparent',
    titleColor: 'text-violet-900 dark:text-violet-100',
    accentBar: 'bg-violet-500',
    headerShell: 'border-violet-500/30 bg-violet-500/5',
    subNavShell: 'border-violet-500/25 bg-violet-500/[0.03]',
    subTabActive:
      'data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:border-violet-700/40 data-[state=active]:shadow-sm data-[state=active]:font-semibold',
    subTabInactive: 'text-muted-foreground hover:bg-violet-500/10 hover:text-violet-950 dark:hover:text-violet-50 border-transparent',
    workArea: 'border-violet-500/25 border-t-[3px] border-t-violet-500 bg-card',
    activeSubStrip: 'bg-violet-500/10 border-violet-500/20 text-violet-950 dark:text-violet-100',
  },
  accounting: {
    mainTabActive:
      'data-[state=active]:bg-slate-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:border-slate-700/30 data-[state=active]:font-semibold',
    mainTabInactive: 'text-slate-800/70 dark:text-slate-100/70 hover:bg-slate-500/10 border-transparent',
    titleColor: 'text-slate-900 dark:text-slate-100',
    accentBar: 'bg-slate-500',
    headerShell: 'border-slate-500/30 bg-slate-500/5',
    subNavShell: 'border-slate-500/25 bg-slate-500/[0.03]',
    subTabActive:
      'data-[state=active]:bg-slate-600 data-[state=active]:text-white data-[state=active]:border-slate-700/40 data-[state=active]:shadow-sm data-[state=active]:font-semibold',
    subTabInactive: 'text-muted-foreground hover:bg-slate-500/10 hover:text-slate-950 dark:hover:text-slate-50 border-transparent',
    workArea: 'border-slate-500/25 border-t-[3px] border-t-slate-500 bg-card',
    activeSubStrip: 'bg-slate-500/10 border-slate-500/20 text-slate-950 dark:text-slate-100',
  },
};

export function getFinanceSectionTheme(sectionId: FinanceMainSectionId): FinanceSectionTheme {
  return THEMES[sectionId];
}
