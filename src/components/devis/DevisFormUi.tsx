import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/** Champ formulaire avec label cohérent. */
export function DevisField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  );
}

export function DevisFormSection({
  title,
  description,
  icon: Icon,
  badge,
  action,
  children,
  className,
  tone = 'default',
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'vente' | 'achat';
}) {
  const toneClass =
    tone === 'vente'
      ? 'border-emerald-500/30 bg-emerald-500/[0.04] shadow-sm shadow-emerald-500/5'
      : tone === 'achat'
        ? 'border-orange-500/30 bg-orange-500/[0.04] shadow-sm shadow-orange-500/5'
        : 'border-border bg-card';

  return (
    <section className={cn('rounded-xl border p-4 sm:p-5 space-y-4', toneClass, className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DevisSegmentedOption<T extends string>({
  value,
  current,
  onSelect,
  label,
  sublabel,
  icon: Icon,
  className,
  accent = 'vente',
}: {
  value: T;
  current: T;
  onSelect: (v: T) => void;
  label: string;
  sublabel?: string;
  icon?: LucideIcon;
  className?: string;
  accent?: 'vente' | 'achat';
}) {
  const active = current === value;
  const activeClass =
    accent === 'achat'
      ? 'border-orange-600 bg-orange-500/10 text-orange-800 dark:text-orange-200 shadow-sm'
      : 'border-emerald-600 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 shadow-sm';
  const activeIconClass = accent === 'achat' ? 'text-orange-600' : 'text-emerald-600';
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-3 py-3 text-center transition-all min-h-[4rem]',
        active ? activeClass : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/40',
        className
      )}
    >
      {Icon && <Icon className={cn('h-5 w-5', active && activeIconClass)} />}
      <span className="text-sm font-semibold leading-tight">{label}</span>
      {sublabel && <span className="text-[10px] leading-tight opacity-80">{sublabel}</span>}
    </button>
  );
}

export function DevisSegmentedGrid({
  children,
  cols = 2,
}: {
  children: ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        'grid gap-2',
        cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
      )}
    >
      {children}
    </div>
  );
}

export function DevisPricingToggle({
  isTtc,
  onChange,
  embedded,
  compact,
}: {
  isTtc: boolean;
  onChange: (v: boolean) => void;
  /** Sans bordure externe — pour cellule de tableau */
  embedded?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        embedded ? 'px-0.5 py-0.5' : 'rounded-lg border bg-muted/30 px-4 py-3',
        compact && 'rounded-md border border-border/70 bg-background/80 px-3 py-2'
      )}
    >
      {!compact && (
        <div>
          <p className="text-sm font-medium">Mode de tarification</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isTtc
              ? 'Afficher TVA, montant TTC et timbre dans la synthèse'
              : 'Prix unitaires et totaux du tableau en hors taxes'}
          </p>
        </div>
      )}
      {compact && <span className="text-xs font-medium text-muted-foreground shrink-0">Tarification</span>}
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('text-xs font-medium', !isTtc && 'text-primary')}>HT</span>
        <Switch checked={isTtc} onCheckedChange={onChange} aria-label="Basculer HT / TTC" />
        <span className={cn('text-xs font-medium', isTtc && 'text-primary')}>TTC</span>
      </div>
    </div>
  );
}

export function DevisFodecToggle({
  enabled,
  onChange,
  compact,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/80 px-3 py-2',
        !compact && 'rounded-lg bg-muted/30 px-4 py-3'
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">FODEC</p>
        {!compact && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            Colonne FODEC (1 %) dans le tableau articles
          </p>
        )}
      </div>
      <Switch checked={enabled} onCheckedChange={onChange} aria-label="Activer FODEC" />
    </div>
  );
}

export function DevisDocumentSettingsBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
      {children}
    </div>
  );
}

export function DevisDocumentSettingsGroup({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {label && (
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-0.5">
          {label}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function DevisFormPageHeader({
  title,
  subtitle,
  badges,
  onCancel,
  cancelLabel = 'Annuler',
}: {
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-1 border-b border-border/60">
      <div className="space-y-1.5 min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        {badges && <div className="flex flex-wrap gap-2 pt-0.5">{badges}</div>}
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          {cancelLabel}
        </button>
      )}
    </div>
  );
}

export function DevisFlowBadge({
  devisType,
  docType,
}: {
  devisType: 'achat' | 'vente';
  docType: 'devis' | 'bc' | 'ba';
}) {
  const isAchat = devisType === 'achat';
  const docLabel = docType === 'bc' ? 'Bon de commande' : docType === 'ba' ? 'Bon d\'achat' : 'Devis';
  return (
    <>
      <Badge variant="outline" className="font-normal">
        {docLabel}
      </Badge>
      <Badge
        className={cn(
          'font-normal border-0 text-white',
          isAchat ? 'bg-orange-600 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-600'
        )}
      >
        {isAchat ? 'Achat' : 'Vente'}
      </Badge>
    </>
  );
}

export function DevisItemsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-dashed border-border bg-muted/20">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <span className="text-2xl text-muted-foreground" aria-hidden>
          —
        </span>
      </div>
      <p className="text-sm font-medium text-foreground">Aucun article pour l&apos;instant</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
        Remplissez la dernière ligne du tableau (catalogue ou saisie libre), puis validez avec Entrée ou le bouton +.
      </p>
    </div>
  );
}

export function DevisTotalsStrip({
  totals,
}: {
  totals: {
    totalHT: number;
    totalRemise: number;
    totalNet: number;
    totalTVA: number;
    totalTTC: number;
    totalFinal: number;
    totalFinalHT: number;
  };
}) {
  const cells = [
    { label: 'Total HT', value: totals.totalHT.toFixed(3), className: '' },
    { label: 'Remise', value: `-${totals.totalRemise.toFixed(3)}`, className: 'text-destructive' },
    { label: 'Net HT', value: totals.totalNet.toFixed(3), className: '' },
    { label: 'TVA', value: totals.totalTVA.toFixed(3), className: '' },
    { label: 'Total TTC', value: totals.totalTTC.toFixed(3), className: '' },
    { label: 'Timbre', value: '1.000', className: '' },
  ];

  return (
    <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Synthèse
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg bg-background/80 border px-2 py-2">
            <p className="text-[10px] uppercase text-muted-foreground">{c.label}</p>
            <p className={cn('text-sm font-semibold tabular-nums mt-0.5', c.className)}>{c.value}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/80 px-1">
        <span className="text-sm font-medium">À payer (TTC + timbre)</span>
        <span className="text-lg font-bold text-primary tabular-nums">
          {totals.totalFinal.toFixed(3)} TND
        </span>
      </div>
    </div>
  );
}

export function DevisStickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 px-1 pt-4 pb-1 bg-gradient-to-t from-card from-70% to-transparent">
      <div className="flex flex-col-reverse sm:flex-row gap-2 rounded-xl border bg-card/95 backdrop-blur p-3 shadow-sm">
        {children}
      </div>
    </div>
  );
}

/** Grille champs prix (qté, PU, remise, TVA…) — responsive. */
export function DevisPriceFieldsGrid({
  children,
  cols,
}: {
  children: ReactNode;
  cols: number;
}) {
  const colClass =
    cols >= 6
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
      : cols >= 5
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
        : cols >= 4
          ? 'grid-cols-2 sm:grid-cols-4'
          : 'grid-cols-2 sm:grid-cols-3';
  return <div className={cn('grid gap-3', colClass)}>{children}</div>;
}

/** Grille formulaire devis (client, document, articles) */
export const devisFormTableThClass =
  'border border-border bg-muted px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap';

export const devisFormTableTdClass = 'border border-border px-2 py-2 align-top bg-card';

export const devisFormTableInputClass =
  'h-9 w-full min-w-0 rounded-md border-2 border-input bg-card px-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-input focus:outline-none focus:ring-2 focus:ring-ring/25';

export function DevisFormTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-md border-2 border-border', className)}>
      <table className="w-full table-fixed border-collapse text-sm">{children}</table>
    </div>
  );
}

/** Inputs intégrés au tableau type Zoho Books */
export const devisZohoCellInputClass =
  'h-9 w-full min-w-0 rounded-md border-2 border-input bg-card px-2 text-sm tabular-nums text-foreground shadow-sm placeholder:text-muted-foreground focus:border-input focus:outline-none focus:ring-2 focus:ring-ring/25 transition-colors';

export const devisZohoCellTextareaClass =
  'w-full min-w-0 rounded-md border-2 border-input bg-card px-2 py-1.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-input focus:outline-none focus:ring-2 focus:ring-ring/25 resize-y min-h-[2.25rem] transition-colors';

export function DevisZohoShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border-2 border-border bg-card shadow-sm overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DevisZohoTopBar({ children }: { children: ReactNode }) {
  return <div className="border-b-2 border-border bg-muted/40 px-4 sm:px-6 py-4 space-y-4">{children}</div>;
}

export function DevisZohoSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('px-4 sm:px-6 py-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DevisZohoTotalsPanel({
  totals,
  showTva = true,
}: {
  totals: {
    totalHT: number;
    totalRemise: number;
    totalNet: number;
    totalTVA: number;
    totalTTC: number;
    totalFinal: number;
    totalFinalHT: number;
    totalFodec?: number;
  };
  showTva?: boolean;
}) {
  const rows: { label: string; value: string; bold?: boolean; accent?: boolean }[] = [
    { label: 'Sous-total', value: `${totals.totalHT.toFixed(3)} TND` },
  ];
  if (totals.totalRemise > 0) {
    rows.push({ label: 'Remise', value: `-${totals.totalRemise.toFixed(3)} TND` });
  }
  rows.push({ label: 'Net HT', value: `${totals.totalNet.toFixed(3)} TND` });
  if (showTva) {
    rows.push({ label: 'TVA', value: `${totals.totalTVA.toFixed(3)} TND` });
    rows.push({ label: 'Montant TTC', value: `${totals.totalTTC.toFixed(3)} TND` });
    if (totals.totalFodec !== undefined && totals.totalFodec > 0) {
      rows.push({ label: 'FODEC (1%)', value: `${totals.totalFodec.toFixed(3)} TND` });
    }
    rows.push({ label: 'Timbre fiscal', value: '1.000 TND' });
  }

  const finalLabel = showTva ? 'À payer (TTC + timbre)' : 'Net HT';
  const finalValue = showTva ? totals.totalFinal : totals.totalNet;

  return (
    <div className="w-full max-w-sm ml-auto rounded-lg border bg-muted/20 p-4 space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{r.label}</span>
          <span className={cn('tabular-nums font-medium text-foreground', r.accent && 'text-primary')}>
            {r.value}
          </span>
        </div>
      ))}
      <div className="flex justify-between gap-4 pt-3 mt-1 border-t border-border/80">
        <span className="text-sm font-semibold text-foreground">{finalLabel}</span>
        <span className="text-lg font-bold text-primary tabular-nums">
          {finalValue.toFixed(3)} TND
        </span>
      </div>
    </div>
  );
}

export function DevisZohoFooter({
  editing,
  isSaving,
  onCancel,
  onSave,
  onUpdate,
  onSaveDraft,
  saveLabel,
  draftSavedAt,
}: {
  editing: boolean;
  isSaving?: boolean;
  onCancel: () => void;
  onSave: () => void;
  onUpdate: () => void;
  onSaveDraft?: () => void;
  saveLabel?: string;
  draftSavedAt?: string | null;
}) {
  return (
    <div className="border-t border-border/70 bg-muted/15 px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:mr-auto">
        {onSaveDraft && !editing && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isSaving}
            className="inline-flex items-center justify-center h-10 px-4 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-muted/60 disabled:opacity-50"
          >
            Enregistrer comme brouillon
          </button>
        )}
        <button
          type="button"
          onClick={editing ? onUpdate : onSave}
          disabled={isSaving}
          className="inline-flex items-center justify-center h-10 px-6 rounded-md bg-[#1b9a8a] hover:bg-[#168a7c] text-white text-sm font-semibold shadow-sm disabled:opacity-50"
        >
          {isSaving ? 'Enregistrement…' : editing ? 'Mettre à jour' : saveLabel ?? 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center h-10 px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          Annuler
        </button>
      </div>
      {draftSavedAt && !editing && (
        <p className="text-[11px] text-muted-foreground sm:ml-auto tabular-nums">
          Brouillon local enregistré ·{' '}
          {new Date(draftSavedAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}
