/**
 * Excel-like grid borders (visible vertical column lines + horizontal row lines)
 * for data tables. Apply to a wrapper element around a <table>.
 */
export const EXCEL_TABLE_CLASS =
  '[&_table]:border-collapse [&_table]:border-2 [&_table]:border-border [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:bg-muted [&_td]:bg-card';

/** Commercial section (rose) — RDV, galerie grids */
export const COMMERCIAL_EXCEL_TABLE_CLASS =
  '[&_table]:w-full [&_table]:border-collapse [&_table]:border-2 [&_table]:border-border [&_th]:border [&_td]:border [&_th]:border-rose-500/40 [&_td]:border-border [&_th]:bg-rose-600 [&_th]:text-white [&_th]:text-xs [&_th]:font-semibold [&_th]:px-2 [&_th]:py-2.5 [&_td]:px-2 [&_td]:py-2 [&_td]:text-sm [&_td]:bg-card [&_tbody_tr:nth-child(even)]:bg-rose-500/[0.06] [&_tbody_tr:hover]:bg-rose-500/10';

/** Ventes / devis (emerald) */
export const VENTES_EXCEL_TABLE_CLASS =
  '[&_table]:w-full [&_table]:border-collapse [&_table]:border-2 [&_table]:border-border [&_th]:border [&_td]:border [&_th]:border-emerald-600/40 [&_td]:border-border [&_th]:bg-emerald-600 [&_th]:text-white [&_th]:text-xs [&_th]:font-semibold [&_th]:px-3 [&_th]:py-2.5 [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-sm [&_td]:bg-card [&_tbody_tr:nth-child(even)]:bg-emerald-500/[0.05] [&_tbody_tr:hover]:bg-emerald-500/10';

/** Achats devis (orange) */
export const ACHATS_EXCEL_TABLE_CLASS =
  '[&_table]:w-full [&_table]:border-collapse [&_table]:border-2 [&_table]:border-border [&_th]:border [&_td]:border [&_th]:border-orange-600/40 [&_td]:border-border [&_th]:bg-orange-600 [&_th]:text-white [&_th]:text-xs [&_th]:font-semibold [&_th]:px-3 [&_th]:py-2.5 [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-sm [&_td]:bg-card [&_tbody_tr:nth-child(even)]:bg-orange-500/[0.05] [&_tbody_tr:hover]:bg-orange-500/10';
