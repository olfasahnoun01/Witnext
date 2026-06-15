import { useCallback, useRef, type ReactNode } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { DevisItem, Product } from '@/types';
import { computeArticleTableLineTotalHT, computeDevisLine } from '@/lib/devisPricing';
import { getDevisItemDisplayCode } from '@/lib/devisItemPdf';
import { cn } from '@/lib/utils';
import { DecimalInput } from '@/components/ui/decimal-input';
import { devisZohoCellInputClass, devisZohoCellTextareaClass } from './DevisFormUi';
import { DevisAnchoredDropdown } from './DevisAnchoredDropdown';
import { DevisTvaSelect } from './DevisTvaSelect';

export type DevisArticleComposerMode = 'search' | 'manual';

const TH =
  'border border-border bg-muted px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap';
const TD = 'border border-border px-2 py-2 align-top bg-card';
const TD_COMPOSER = 'border border-border px-2 py-2 align-top bg-muted/50';

export interface DevisArticlesTableProps {
  items: DevisItem[];
  isTtc: boolean;
  devisType: 'achat' | 'vente';
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
  itemRemise: number;
  onItemRemiseChange: (value: number) => void;
  itemTva: number;
  onItemTvaChange: (value: number) => void;
  partyExonereDeTva?: boolean;
  composerSearchRef?: React.RefObject<HTMLInputElement | null>;
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
  itemRemise,
  onItemRemiseChange,
  itemTva,
  onItemTvaChange,
  partyExonereDeTva = false,
  composerSearchRef,
}: DevisArticlesTableProps) {
  const localSearchRef = useRef<HTMLInputElement>(null);
  const composerPrixRef = useRef<HTMLInputElement>(null);
  const searchRef = composerSearchRef ?? localSearchRef;

  const prixUnitHeader =
    devisType === 'achat'
      ? isTtc
        ? 'P. achat TTC'
        : 'P. achat HT'
      : isTtc
        ? 'Prix unitaire TTC'
        : 'Prix unitaire HT';

  const showTvaColumn = isTtc && !partyExonereDeTva;
  const totalHeader = isTtc ? 'Total TTC' : 'Total HT';

  const lineTotal = (item: DevisItem) =>
    isTtc
      ? computeDevisLine(item, true).lineTTC
      : computeArticleTableLineTotalHT(item, devisType, false);

  const composerPreview = lineTotal({
    designation: '',
    fournisseur: '',
    prix_ttc: itemPrixTtc,
    remise: itemRemise,
    quantity: itemQuantity,
    tva: itemTva,
  });

  const handlePickProduct = (product: Product) => {
    onSelectProduct(product);
    requestAnimationFrame(() => composerPrixRef.current?.focus());
  };

  const handleSearchChange = (value: string) => {
    onProductSearchChange(value);
    if (selectedProduct && value.trim() !== `${selectedProduct.sku} — ${selectedProduct.name}`.trim()) {
      onClearProduct();
    }
  };

  return (
    <div className="overflow-x-auto rounded-md border-2 border-border">
      <table className="w-full min-w-[920px] table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: devisType === 'vente' ? '24%' : '30%' }} />
          <col style={{ width: '9%' }} />
          {devisType === 'vente' && <col style={{ width: '12%' }} />}
          <col style={{ width: '12%' }} />
          <col style={{ width: '10%' }} />
          {showTvaColumn && <col style={{ width: '11%' }} />}
          <col style={{ width: '12%' }} />
          <col style={{ width: '5%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={cn(TH, 'text-left')}>Article</th>
            <th className={cn(TH, 'text-center')}>Qté</th>
            {devisType === 'vente' && <th className={cn(TH, 'text-right')}>P. achat HT</th>}
            <th className={cn(TH, 'text-right')}>{prixUnitHeader}</th>
            <th className={cn(TH, 'text-center')}>Remise %</th>
            {showTvaColumn && <th className={cn(TH, 'text-center')}>TVA</th>}
            <th className={cn(TH, 'text-right')}>{totalHeader}</th>
            <th className={cn(TH, 'text-center')} aria-hidden />
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const lineVal = lineTotal(item);
            const code = getDevisItemDisplayCode(item);
            const title = code ? `${code} — ${item.designation}` : item.designation;

            return (
              <tr key={item.line_id ?? `line-${idx}`} className="hover:bg-muted/10">
                <td className={TD}>
                  <input
                    type="text"
                    value={item.designation}
                    onChange={(e) => onUpdate(idx, { designation: e.target.value })}
                    className={cn(devisZohoCellInputClass, 'font-medium text-xs')}
                    placeholder="Désignation"
                  />
                  {code && (
                    <p className="mt-0.5 px-1 text-[10px] font-mono text-muted-foreground truncate" title={code}>
                      {code}
                    </p>
                  )}
                  <textarea
                    value={item.description ?? ''}
                    onChange={(e) =>
                      onUpdate(idx, { description: e.target.value.trim() || undefined })
                    }
                    rows={1}
                    className={cn(devisZohoCellTextareaClass, 'mt-1 text-xs min-h-[1.75rem]')}
                    placeholder="Détails…"
                  />
                </td>
                <td className={TD}>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdate(idx, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                    }
                    className={cn(devisZohoCellInputClass, 'text-center text-xs')}
                    aria-label={`Quantité ${title}`}
                  />
                </td>
                {devisType === 'vente' && (
                  <td className={TD}>
                    <DecimalInput
                      value={item.prix_achat ?? 0}
                      onValueChange={(v) => onUpdate(idx, { prix_achat: v })}
                      className={cn(devisZohoCellInputClass, 'text-right text-xs h-auto py-1.5')}
                    />
                  </td>
                )}
                <td className={TD}>
                  <DecimalInput
                    value={item.prix_ttc}
                    onValueChange={(v) => onUpdate(idx, { prix_ttc: v })}
                    className={cn(devisZohoCellInputClass, 'text-right text-xs h-auto py-1.5')}
                  />
                </td>
                <td className={TD}>
                  <div className="flex items-center gap-0.5">
                    <DecimalInput
                      value={item.remise ?? 0}
                      onValueChange={(v) => onUpdate(idx, { remise: v })}
                      allowEmptyZero
                      className={cn(devisZohoCellInputClass, 'text-center text-xs h-auto py-1.5')}
                    />
                    <span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                </td>
                {showTvaColumn && (
                  <td className={TD}>
                    <DevisTvaSelect
                      value={partyExonereDeTva ? 0 : (item.tva ?? 0)}
                      onChange={(rate) => onUpdate(idx, { tva: rate })}
                      disabled={partyExonereDeTva}
                      className="w-full h-auto py-1.5"
                    />
                  </td>
                )}
                <td className={cn(TD, 'text-right font-semibold tabular-nums text-xs')}>
                  {lineVal.toFixed(3)}
                </td>
                <td className={cn(TD, 'text-center')}>
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label={`Supprimer ${title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}

          <ComposerEnterCommit onCommit={onCommitLine}>
            <td className={TD_COMPOSER}>
              {articleMode === 'search' ? (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={productSearch}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className={cn(devisZohoCellInputClass, 'pl-7 text-xs w-full')}
                      placeholder="Rechercher ou sélectionner un article…"
                      autoComplete="off"
                    />
                  </div>
                  <DevisAnchoredDropdown
                    anchorRef={searchRef}
                    open={searchResults.length > 0}
                    className="max-h-36"
                  >
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => handlePickProduct(p)}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted border-b border-border last:border-b-0"
                      >
                        <span className="font-medium block truncate">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {p.sku} · {p.price.toFixed(3)} HT
                        </span>
                      </button>
                    ))}
                  </DevisAnchoredDropdown>
                  {isSearching && (
                    <p className="text-[10px] text-muted-foreground">Recherche…</p>
                  )}
                  <textarea
                    value={itemDescription}
                    onChange={(e) => onItemDescriptionChange(e.target.value)}
                    rows={1}
                    className={cn(devisZohoCellTextareaClass, 'text-xs min-h-[1.75rem]')}
                    placeholder="Détails (optionnel)…"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={itemDesignation}
                    onChange={(e) => onItemDesignationChange(e.target.value)}
                    className={cn(devisZohoCellInputClass, 'font-medium text-xs w-full')}
                    placeholder="Saisie libre — article…"
                  />
                  <textarea
                    value={itemDescription}
                    onChange={(e) => onItemDescriptionChange(e.target.value)}
                    rows={1}
                    className={cn(devisZohoCellTextareaClass, 'text-xs min-h-[1.75rem]')}
                    placeholder="Détails (optionnel)…"
                  />
                </div>
              )}
            </td>
            <td className={TD_COMPOSER}>
              <input
                type="number"
                min={1}
                value={itemQuantity}
                onChange={(e) => onItemQuantityChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className={cn(devisZohoCellInputClass, 'text-center text-xs w-full')}
              />
            </td>
            {devisType === 'vente' && (
              <td className={TD_COMPOSER}>
                <DecimalInput
                  value={itemPrixAchat}
                  onValueChange={onItemPrixAchatChange}
                  className={cn(devisZohoCellInputClass, 'text-right text-xs w-full h-auto py-1.5')}
                />
              </td>
            )}
            <td className={TD_COMPOSER}>
              <DecimalInput
                ref={composerPrixRef}
                value={itemPrixTtc}
                onValueChange={onItemPrixTtcChange}
                className={cn(devisZohoCellInputClass, 'text-right text-xs w-full h-auto py-1.5')}
                placeholder={
                  devisType === 'vente' && articleMode === 'manual'
                    ? isTtc
                      ? 'Prix vente TTC…'
                      : 'Prix vente HT…'
                    : '0.000'
                }
                aria-label={prixUnitHeader}
              />
            </td>
            <td className={TD_COMPOSER}>
              <div className="flex items-center gap-0.5">
                <DecimalInput
                  value={itemRemise}
                  onValueChange={onItemRemiseChange}
                  allowEmptyZero
                  className={cn(devisZohoCellInputClass, 'text-center text-xs w-full h-auto py-1.5')}
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            </td>
            {showTvaColumn && (
              <td className={TD_COMPOSER}>
                <DevisTvaSelect
                  value={partyExonereDeTva ? 0 : itemTva}
                  onChange={onItemTvaChange}
                  disabled={partyExonereDeTva}
                  className="w-full h-auto py-1.5"
                />
              </td>
            )}
            <td className={cn(TD_COMPOSER, 'text-right tabular-nums text-xs text-muted-foreground')}>
              {composerPreview > 0 ? composerPreview.toFixed(3) : '—'}
            </td>
            <td className={cn(TD_COMPOSER, 'text-center')}>
              <button
                type="button"
                onClick={onCommitLine}
                disabled={!canCommitLine}
                className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-40"
                title="Valider la ligne (Entrée)"
                aria-label="Ajouter la ligne"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </td>
          </ComposerEnterCommit>
        </tbody>
      </table>
    </div>
  );
}
