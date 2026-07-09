/**
 * Module card hover colors — aligned with ERP sidebar themes (sectionThemes.ts).
 */
export interface MarketingModuleTheme {
  iconIdle: string;
  iconHover: string;
  borderHover: string;
  shadowHover: string;
  titleHover: string;
}

export const MARKETING_MODULE_THEMES: Record<string, MarketingModuleTheme> = {
  commercial: {
    iconIdle: 'bg-rose-500/10 text-rose-600',
    iconHover: 'group-hover:bg-rose-600 group-hover:text-white',
    borderHover: 'hover:border-rose-500/50',
    shadowHover: 'hover:shadow-rose-500/15',
    titleHover: 'group-hover:text-rose-700',
  },
  ventes: {
    iconIdle: 'bg-emerald-500/10 text-emerald-600',
    iconHover: 'group-hover:bg-emerald-600 group-hover:text-white',
    borderHover: 'hover:border-emerald-500/50',
    shadowHover: 'hover:shadow-emerald-500/15',
    titleHover: 'group-hover:text-emerald-700',
  },
  achats: {
    iconIdle: 'bg-orange-500/10 text-orange-600',
    iconHover: 'group-hover:bg-orange-600 group-hover:text-white',
    borderHover: 'hover:border-orange-500/50',
    shadowHover: 'hover:shadow-orange-500/15',
    titleHover: 'group-hover:text-orange-700',
  },
  magasin: {
    iconIdle: 'bg-sky-500/10 text-sky-600',
    iconHover: 'group-hover:bg-sky-600 group-hover:text-white',
    borderHover: 'hover:border-sky-500/50',
    shadowHover: 'hover:shadow-sky-500/15',
    titleHover: 'group-hover:text-sky-700',
  },
  rh: {
    iconIdle: 'bg-violet-500/10 text-violet-600',
    iconHover: 'group-hover:bg-violet-600 group-hover:text-white',
    borderHover: 'hover:border-violet-500/50',
    shadowHover: 'hover:shadow-violet-500/15',
    titleHover: 'group-hover:text-violet-700',
  },
  finance: {
    iconIdle: 'bg-amber-500/10 text-amber-600',
    iconHover: 'group-hover:bg-amber-600 group-hover:text-white',
    borderHover: 'hover:border-amber-500/50',
    shadowHover: 'hover:shadow-amber-500/15',
    titleHover: 'group-hover:text-amber-800',
  },
  vehicules: {
    iconIdle: 'bg-teal-500/10 text-teal-600',
    iconHover: 'group-hover:bg-teal-600 group-hover:text-white',
    borderHover: 'hover:border-teal-500/50',
    shadowHover: 'hover:shadow-teal-500/15',
    titleHover: 'group-hover:text-teal-700',
  },
};

export function getMarketingModuleTheme(moduleId: string): MarketingModuleTheme {
  return (
    MARKETING_MODULE_THEMES[moduleId] ?? {
      iconIdle: 'bg-slate-500/10 text-slate-600',
      iconHover: 'group-hover:bg-slate-600 group-hover:text-white',
      borderHover: 'hover:border-slate-500/40',
      shadowHover: 'hover:shadow-slate-500/10',
      titleHover: 'group-hover:text-slate-800',
    }
  );
}
