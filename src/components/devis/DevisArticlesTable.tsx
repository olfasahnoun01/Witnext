import { useCallback, useRef, type ReactNode } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
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
import { DevisAnchoredDropdown } from './DevisAnchoredDropdown';

export type DevisArticleComposerMode = 'search' | 'manual';

const TH =
  'border border-border bg-muted/50 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap';
const TD = 'border border-border px-2 py-2 align-top';
const TD_COMPOSER = 'border border-border px-2 py-2 align-top bg-muted/20';

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
  itemPrixVenteDraft: string | null;
  onItemPrixVenteDraftChange: (value: string | null) => void;
  itemRemise: number;
  onItemRemiseChange: (value: number) => void;
  itemTva: number;
  onItemTvaChange: (value: number) => void;
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
  itemPrixVenteDraft,
  onItemPrixVenteDraftChange,
  itemRemise,
  onItemRemiseChange,
  itemTva,
  onItemTvaChange,
  composerSearchRef,
}: DevisArticlesTableProps) {
  const localSearchRef = useRef<HTMLInputElement>(null);
  const composerPrixRef = useRef<HTMLInputElement>(null);
  const searchRef = composerSearchRef ?? localSearchRef;

  const prixUnitHeader = devisType === 'achat' ? 'P. achat HT' : 'Prix unitaire HT';

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

  const prixUnitDisplay =
    devisType === 'vente'
      ? itemPrixVenteDraft ?? formatDecimalFieldValue(itemPrixTtc)
      : formatDecimalFieldValue(itemPrixTtc);

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
          {isTtc && <col style={{ width: '12%' }} />}
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
            {isTtc && <th className={cn(TH, 'text-center')}>TVA</th>}
            <th className={cn(TH, 'text-right')}>Total HT</th>
            <th className={cn(TH, 'text-center')} aria-hidden />
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const line = computeDevisLine(item, false);
            const lineVal = isTtc ? line.lineTTC : line.lineHT;
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
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatDecimalFieldValue(item.prix_achat ?? 0)}
                      onChange={(e) =>
                        onUpdate(idx, { prix_achat: parseDecimalInput(e.target.value) })
                      }
                      className={cn(devisZohoCellInputClass, 'text-right text-xs')}
                    />
                  </td>
                )}
                <td className={TD}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatDecimalFieldValue(item.prix_ttc)}
                    onChange={(e) =>
                      onUpdate(idx, { prix_ttc: parseDecimalInput(e.target.value) })
                    }
                    className={cn(devisZohoCellInputClass, 'text-right text-xs')}
                  />
                </td>
                <td className={TD}>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.remise ? String(item.remise) : ''}
                      onChange={(e) =>
                        onUpdate(idx, { remise: parseDecimalInput(e.target.value) })
                      }
                      className={cn(devisZohoCellInputClass, 'text-center text-xs')}
                    />
                    <span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                </td>
                {isTtc && (
                  <td className={TD}>
                    <select
                      value={String(item.tva ?? 19)}
                      onChange={(e) => onUpdate(idx, { tva: Number(e.target.value) })}
                      className={cn(devisZohoCellInputClass, 'text-center text-[11px]')}
                    >
                      <option value="7">7%</option>
                      <option value="13">13%</option>
                      <option value="19">19%</option>
                    </select>
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
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatDecimalFieldValue(itemPrixAchat)}
                  onChange={(e) => onItemPrixAchatChange(parseDecimalInput(e.target.value))}
                  className={cn(devisZohoCellInputClass, 'text-right text-xs w-full')}
                />
              </td>
            )}
            <td className={TD_COMPOSER}>
              <input
                ref={composerPrixRef}
                type="text"
                inputMode="decimal"
                value={prixUnitDisplay}
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
                className={cn(devisZohoCellInputClass, 'text-right text-xs w-full')}
                placeholder="0.000"
                aria-label={prixUnitHeader}
              />
            </td>
            <td className={TD_COMPOSER}>
              <div className="flex items-center gap-0.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={itemRemise ? String(itemRemise) : ''}
                  onChange={(e) => onItemRemiseChange(parseDecimalInput(e.target.value))}
                  className={cn(devisZohoCellInputClass, 'text-center text-xs')}
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            </td>
            {isTtc && (
              <td className={TD_COMPOSER}>
                <select
                  value={String(itemTva)}
                  onChange={(e) => onItemTvaChange(Number(e.target.value))}
                  className={cn(devisZohoCellInputClass, 'text-center text-[11px] w-full')}
                >
                  <option value="7">7%</option>
                  <option value="13">13%</option>
                  <option value="19">19%</option>
                </select>
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
