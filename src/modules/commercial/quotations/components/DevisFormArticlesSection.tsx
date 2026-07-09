import { Edit, Layers, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DevisArticlesTable } from '@/components/devis/DevisArticlesTable';
import { DevisSegmentedGrid, DevisSegmentedOption, DevisZohoSection } from '@/components/devis/DevisFormUi';
import type { DevisItem, Product } from '@/types';
import type { RefObject } from 'react';

type ArticleMode = 'search' | 'manual';

export type DevisFormArticlesSectionProps = {
  isAchat: boolean;
  devisType: 'achat' | 'vente';
  isFodecEnabled: boolean;
  partyExonereDeTva: boolean;
  isTtc: boolean;
  devisItems: DevisItem[];
  articleMode: ArticleMode;
  onArticleModeSelect: (mode: ArticleMode) => void;
  onOpenAddVariant: () => void;
  onOpenNewArticle: () => void;
  composerSearchRef: RefObject<HTMLInputElement | null>;
  onUpdateLine: (idx: number, patch: Partial<DevisItem>) => void;
  onRemoveLine: (idx: number) => void;
  onCommitLine: () => void;
  canCommitLine: boolean;
  productSearch: string;
  onProductSearchChange: (v: string) => void;
  searchResults: Product[];
  isSearching: boolean;
  selectedProduct: Product | null;
  onSelectProduct: (product: Product) => void;
  onClearProduct: () => void;
  itemDesignation: string;
  onItemDesignationChange: (v: string) => void;
  itemDescription: string;
  onItemDescriptionChange: (v: string) => void;
  itemQuantity: number;
  onItemQuantityChange: (v: number) => void;
  itemPrixAchat: number;
  onItemPrixAchatChange: (v: number) => void;
  itemPrixTtc: number;
  onItemPrixTtcChange: (v: number) => void;
  itemRemise: number;
  onItemRemiseChange: (v: number) => void;
  itemTva: number;
  onItemTvaChange: (v: number) => void;
  itemFodec: number | null;
  onItemFodecChange: (v: number | null) => void;
};

export function DevisFormArticlesSection({
  isAchat,
  devisType,
  isFodecEnabled,
  partyExonereDeTva,
  isTtc,
  devisItems,
  articleMode,
  onArticleModeSelect,
  onOpenAddVariant,
  onOpenNewArticle,
  composerSearchRef,
  onUpdateLine,
  onRemoveLine,
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
  itemFodec,
  onItemFodecChange,
}: DevisFormArticlesSectionProps) {
  return (
    <DevisZohoSection
      title="Tableau d'articles"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <DevisSegmentedGrid cols={2}>
            <DevisSegmentedOption
              value="search"
              current={articleMode}
              accent={isAchat ? 'achat' : 'vente'}
              onSelect={onArticleModeSelect}
              label="Catalogue"
              icon={Search}
              className="min-h-[2.25rem] py-2"
            />
            <DevisSegmentedOption
              value="manual"
              current={articleMode}
              accent={isAchat ? 'achat' : 'vente'}
              onSelect={onArticleModeSelect}
              label="Saisie libre"
              icon={Edit}
              className="min-h-[2.25rem] py-2"
            />
          </DevisSegmentedGrid>
          <Button variant="outline" size="sm" onClick={onOpenAddVariant} className="h-8 text-xs">
            <Layers className="w-3.5 h-3.5 mr-1" />
            Variante
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenNewArticle} className="h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Nouvel article
          </Button>
        </div>
      }
    >
      <DevisArticlesTable
        items={devisItems}
        isTtc={isTtc}
        devisType={devisType}
        articleMode={articleMode}
        composerSearchRef={composerSearchRef}
        onUpdate={onUpdateLine}
        onRemove={onRemoveLine}
        onCommitLine={onCommitLine}
        canCommitLine={canCommitLine}
        productSearch={productSearch}
        onProductSearchChange={onProductSearchChange}
        searchResults={searchResults}
        isSearching={isSearching}
        selectedProduct={selectedProduct}
        onSelectProduct={onSelectProduct}
        onClearProduct={onClearProduct}
        itemDesignation={itemDesignation}
        onItemDesignationChange={onItemDesignationChange}
        itemDescription={itemDescription}
        onItemDescriptionChange={onItemDescriptionChange}
        itemQuantity={itemQuantity}
        onItemQuantityChange={onItemQuantityChange}
        itemPrixAchat={itemPrixAchat}
        onItemPrixAchatChange={onItemPrixAchatChange}
        itemPrixTtc={itemPrixTtc}
        onItemPrixTtcChange={onItemPrixTtcChange}
        itemRemise={itemRemise}
        onItemRemiseChange={onItemRemiseChange}
        itemTva={itemTva}
        onItemTvaChange={onItemTvaChange}
        itemFodec={itemFodec}
        onItemFodecChange={onItemFodecChange}
        partyExonereDeTva={partyExonereDeTva}
        showFodecColumn={isAchat && isFodecEnabled && !partyExonereDeTva}
      />
    </DevisZohoSection>
  );
}
