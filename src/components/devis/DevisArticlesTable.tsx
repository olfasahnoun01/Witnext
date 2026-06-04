import { useCallback, type ReactNode } from 'react';
import { Package, Plus, Search, Trash2, X } from 'lucide-react';
import type { DevisItem, Product } from '@/types';
import { computeDevisLine } from '@/lib/devisPricing';
import { getDevisItemDisplayCode } from '@/lib/devisItemPdf';
import {
  parseDecimalInput,
  parseDecimalInputLoose,
  formatDecimalFieldValue,
} from '@/lib/numberInput';
import { cn } from '@/lib/utils';
import { devisZohoCellInputClass, devisZohoCellTextareaClass } from './DevisFormUi';

export type DevisArticleComposerMode = 'search' | 'manual';

export interface DevisArticlesTableProps {
  items: DevisItem[];
  isTtc: boolean;
  devisType: 'achat' | 'vente';
  isAchat: boolean;
  articleMode: DevisArticleComposerMode;
  onUpdate: (idx: number, patch: Partial<DevisItem>) => void;
  onRemove: (idx: number) => void;
  onCommitLine: () => void;
  canCommitLine: boolean;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  searchResults: Product[];
  isSearching: boolean;
  selectedProduct: Product | null;
  onSelectProduct: (product: Product) => void;
  onClearProduct: () => void;
  itemDesignation: string;
  onItemDesignationChange: (value: string) => void;
  itemDescription: string;
  onItemDescriptionChange: (value: string) => void;
  itemQuantity: number;
  onItemQuantityChange: (value: number) => void;
  itemPrixAchat: number;
  onItemPrixAchatChange: (value: number) => void;
  itemPrixTtc: number;
  onItemPrixTtcChange: (value: number) => void;
  itemPrixVenteDraft: string | null;
  onItemPrixVenteDraftChange: (value: string | null) => void;
  itemRemise: number;
  onItemRemiseChange: (value: number) => void;
  itemTva: number;
  onItemTvaChange: (value: number) => void;
}

function ComposerEnterCommit({
  onCommit,
  children,
}: {
  onCommit: () => void;
  children: ReactNode;
}) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA') return;
      e.preventDefault();
      onCommit();
    },
    [onCommit]
  );
  return <tr onKeyDown={onKeyDown}>{children}</tr>;
}

export function DevisArticlesTable({
  items,
  isTtc,
  devisType,
  isAchat,
  articleMode,
  onUpdate,
  onRemove,
  onCommitLine,
  canCommitLine,
  productSearch,
  onProductSearchChange,
  searchResults,
  isSearching,
  selectedProduct,
  onSelectProduct,
  onClearProduct,
  itemDesignation,
  onItemDesignationChange,
  itemDescription,
  onItemDescriptionChange,
  itemQuantity,
  onItemQuantityChange,
  itemPrixAchat,
  onItemPrixAchatChange,
  itemPrixTtc,
  onItemPrixTtcChange,
  itemPrixVenteDraft,
  onItemPrixVenteDraftChange,
  itemRemise,
  onItemRemiseChange,
  itemTva,
  onItemTvaChange,
}: DevisArticlesTableProps) {
  const rateLabel = devisType === 'achat' ? 'Prix achat HT' : 'Prix vente HT';
  const previewLine = computeDevisLine(
    {
      designation: '',
      fournisseur: '',
      prix_ttc: itemPrixTtc,
      remise: itemRemise,
      quantity: itemQuantity,
      tva: itemTva,
    },
    false
  );
  const composerPreview = isTtc ? previewLine.lineTTC : previewLine.lineHT;

  const prixVenteDisplay =
    devisType === 'vente'
      ? itemPrixVenteDraft ?? formatDecimalFieldValue(itemPrixTtc)
      : formatDecimalFieldValue(itemPrixTtc);

  return (
    <div className="overflow-x-auto rounded-lg border border-border/80">
      <table className="w-full min-w-[880px] text-sm border-collapse">
        <thead>
          <tr className="border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="text-left py-3 px-3 min-w-[280px]">Détails de l&apos;article</th>
            <th className="text-center py-3 px-2 w-[88px]">Quantité</th>
            {devisType === 'vente' && (
              <th className="text-right py-3 px-2 w-[96px] hidden lg:table-cell">P. achat HT</th>
            )}
            <th className="text-right py-3 px-2 w-[100px]">Taux</th>
            <th className="text-center py-3 px-2 w-[80px]">Remise</th>
            {isTtc && <th className="text-center py-3 px-2 w-[100px]">Taxe</th>}
            <th className="text-right py-3 px-3 w-[108px]">Montant</th>
            <th className="w-10 py-3" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const line = computeDevisLine(item, false);
            const lineVal = isTtc ? line.lineTTC : line.lineHT;
            const code = getDevisItemDisplayCode(item);
            const title = code ? `${code} — ${item.designation}` : item.designation;

            return (
              <tr
                key={item.line_id ?? `line-${idx}`}
                className="border-b border-border/50 align-top hover:bg-muted/15 transition-colors"
              >
                <td className="py-2 px-2">
                  <div className="flex gap-2">
                    <div className="mt-1 h-10 w-10 shrink-0 rounded-md border border-dashed border-border/80 bg-muted/30 flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground/60" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <input
                        type="text"
                        value={item.designation}
                        onChange={(e) => onUpdate(idx, { designation: e.target.value })}
                        className={cn(devisZohoCellInputClass, 'font-medium')}
                        placeholder="Désignation"
                      />
                      {code && (
                        <p className="px-2 text-[11px] font-mono text-muted-foreground truncate" title={code}>
                          {code}
                        </p>
                      )}
                      <textarea
                        value={item.description ?? ''}
                        onChange={(e) =>
                          onUpdate(idx, {
                            description: e.target.value.trim() || undefined,
                          })
                        }
                        rows={2}
                        className={devisZohoCellTextareaClass}
                        placeholder="Description (pointures, tailles…)"
                      />
                    </div>
                  </div>
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdate(idx, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                    }
                    className={cn(devisZohoCellInputClass, 'text-center')}
                    aria-label={`Quantité ${title}`}
                  />
                  <p className="text-[10px] text-center text-muted-foreground mt-0.5">pcs</p>
                </td>
                {devisType === 'vente' && (
                  <td className="py-2 px-2 hidden lg:table-cell">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatDecimalFieldValue(item.prix_achat ?? 0)}
                      onChange={(e) =>
                        onUpdate(idx, { prix_achat: parseDecimalInput(e.target.value) })
                      }
                      className={cn(devisZohoCellInputClass, 'text-right')}
                    />
                  </td>
                )}
                <td className="py-2 px-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatDecimalFieldValue(item.prix_ttc)}
                    onChange={(e) =>
                      onUpdate(idx, { prix_ttc: parseDecimalInput(e.target.value) })
                    }
                    className={cn(devisZohoCellInputClass, 'text-right')}
                  />
                  <p className="text-[10px] text-right text-muted-foreground/80 mt-0.5 pr-1">HT</p>
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-0.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.remise ? String(item.remise) : ''}
                      onChange={(e) =>
                        onUpdate(idx, { remise: parseDecimalInput(e.target.value) })
                      }
                      className={cn(devisZohoCellInputClass, 'text-center')}
                    />
                    <span className="text-xs text-muted-foreground shrink-0">%</span>
                  </div>
                </td>
                {isTtc && (
                  <td className="py-2 px-2">
                    <select
                      value={String(item.tva ?? 19)}
                      onChange={(e) => onUpdate(idx, { tva: Number(e.target.value) })}
                      className={cn(devisZohoCellInputClass, 'text-center text-xs')}
                    >
                      <option value="7">TVA 7%</option>
                      <option value="13">TVA 13%</option>
                      <option value="19">TVA 19%</option>
                    </select>
                  </td>
                )}
                <td className="py-2 px-3 text-right font-semibold tabular-nums text-foreground">
                  {lineVal.toFixed(3)}
                </td>
                <td className="py-2 px-1">
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label={`Supprimer ${title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}

          <ComposerEnterCommit onCommit={onCommitLine}>
            <td className="py-3 px-2 align-top bg-muted/10">
              <div className="flex gap-2">
                <div className="mt-1 h-10 w-10 shrink-0 rounded-md border border-dashed border-primary/30 bg-primary/5 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-primary/70" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {articleMode === 'search' ? (
                    <>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => onProductSearchChange(e.target.value)}
                          className={cn(devisZohoCellInputClass, 'pl-8')}
                          placeholder="Saisissez ou sélectionnez un article du catalogue…"
                        />
                      </div>
                      {searchResults.length > 0 && (
                        <div className="rounded-md border border-border bg-popover shadow-md max-h-40 overflow-y-auto z-20">
                          {searchResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => onSelectProduct(p)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border/40 last:border-0"
                            >
                              <span className="font-medium">{p.name}</span>
                              <span className="block text-xs text-muted-foreground font-mono">
                                {p.sku} · {p.price.toFixed(3)} HT
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {isSearching && (
                        <p className="text-[11px] text-muted-foreground px-1">Recherche…</p>
                      )}
                      {selectedProduct && (
                        <div className="flex items-start gap-2 rounded-md border border-primary/25 bg-primary/5 px-2 py-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{selectedProduct.name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{selectedProduct.sku}</p>
                          </div>
                          <button
                            type="button"
                            onClick={onClearProduct}
                            className="p-1 text-muted-foreground hover:text-destructive"
                            aria-label="Retirer la sélection"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <textarea
                        value={itemDescription}
                        onChange={(e) => onItemDescriptionChange(e.target.value)}
                        rows={2}
                        className={devisZohoCellTextareaClass}
                        placeholder="Description (pointures, tailles…)"
                      />
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={itemDesignation}
                        onChange={(e) => onItemDesignationChange(e.target.value)}
                        className={cn(devisZohoCellInputClass, 'font-medium')}
                        placeholder="Saisie libre — désignation de l'article…"
                      />
                      <textarea
                        value={itemDescription}
                        onChange={(e) => onItemDescriptionChange(e.target.value)}
                        rows={2}
                        className={devisZohoCellTextareaClass}
                        placeholder="Description (pointures, tailles…)"
                      />
                    </>
                  )}
                </div>
              </div>
            </td>
            <td className="py-3 px-2 align-top bg-muted/10">
              <input
                type="number"
                min={1}
                value={itemQuantity}
                onChange={(e) => onItemQuantityChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className={cn(devisZohoCellInputClass, 'text-center')}
              />
              <p className="text-[10px] text-center text-muted-foreground mt-0.5">pcs</p>
            </td>
            {devisType === 'vente' && (
              <td className="py-3 px-2 align-top bg-muted/10 hidden lg:table-cell">
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatDecimalFieldValue(itemPrixAchat)}
                  onChange={(e) => onItemPrixAchatChange(parseDecimalInput(e.target.value))}
                  className={cn(devisZohoCellInputClass, 'text-right')}
                />
              </td>
            )}
            <td className="py-3 px-2 align-top bg-muted/10">
              <input
                type="text"
                inputMode="decimal"
                value={prixVenteDisplay}
                onChange={(e) => {
                  if (devisType === 'vente') {
                    onItemPrixVenteDraftChange(e.target.value);
                    onItemPrixTtcChange(parseDecimalInputLoose(e.target.value));
                  } else {
                    onItemPrixTtcChange(parseDecimalInput(e.target.value));
                  }
                }}
                onFocus={
                  devisType === 'vente'
                    ? () =>
                        onItemPrixVenteDraftChange(
                          itemPrixTtc === 0 ? '' : formatDecimalFieldValue(itemPrixTtc)
                        )
                    : undefined
                }
                onBlur={devisType === 'vente' ? () => onItemPrixVenteDraftChange(null) : undefined}
                className={cn(devisZohoCellInputClass, 'text-right')}
                placeholder={isAchat ? rateLabel : 'PU vente HT'}
                aria-label={rateLabel}
              />
              <p className="text-[10px] text-right text-muted-foreground/80 mt-0.5 pr-1">HT</p>
            </td>
            <td className="py-3 px-2 align-top bg-muted/10">
              <div className="flex items-center gap-0.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={itemRemise ? String(itemRemise) : ''}
                  onChange={(e) => onItemRemiseChange(parseDecimalInput(e.target.value))}
                  className={cn(devisZohoCellInputClass, 'text-center')}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </td>
            {isTtc && (
              <td className="py-3 px-2 align-top bg-muted/10">
                <select
                  value={String(itemTva)}
                  onChange={(e) => onItemTvaChange(Number(e.target.value))}
                  className={cn(devisZohoCellInputClass, 'text-center text-xs')}
                >
                  <option value="7">TVA 7%</option>
                  <option value="13">TVA 13%</option>
                  <option value="19">TVA 19%</option>
                </select>
              </td>
            )}
            <td className="py-3 px-3 align-top bg-muted/10 text-right tabular-nums text-muted-foreground text-sm">
              {composerPreview > 0 ? composerPreview.toFixed(3) : '—'}
            </td>
            <td className="py-3 px-1 align-top bg-muted/10">
              <button
                type="button"
                onClick={onCommitLine}
                disabled={!canCommitLine}
                className="p-2 rounded-md text-primary hover:bg-primary/10 disabled:opacity-40 disabled:pointer-events-none"
                title="Valider la ligne (Entrée)"
                aria-label="Ajouter la ligne au tableau"
              >
                <Plus className="h-4 w-4" />
              </button>
            </td>
          </ComposerEnterCommit>
        </tbody>
      </table>
      <p className="text-[11px] text-muted-foreground px-3 py-2 border-t border-border/50 bg-muted/5">
        Catalogue ou saisie libre dans la dernière ligne ·{' '}
        <kbd className="px-1 rounded bg-muted text-[10px]">Entrée</kbd> pour ajouter au tableau
      </p>
    </div>
  );
}
