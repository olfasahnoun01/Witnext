import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import {
  mapLightRowToProduct,
  pickPrixAchatHtFromFournisseurRows,
  prixAchatHtFromVariantProduct,
  searchInventoryProductsLight,
} from '@/lib/inventoryProductSearch';
import type { Product } from '@/types';

type UseDevisCatalogSearchArgs = {
  devisType: 'achat' | 'vente';
  thirdPartyName: string;
  onComposerDirtyChange?: (dirty: boolean) => void;
};

export function useDevisCatalogSearch({
  devisType,
  thirdPartyName,
  onComposerDirtyChange,
}: UseDevisCatalogSearchArgs) {
  const isAchat = devisType === 'achat';
  const [articleMode, setArticleMode] = useState<'search' | 'manual'>('search');
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(productSearch, 300);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const achatPriceRequestRef = useRef(0);
  const composerSearchRef = useRef<HTMLInputElement>(null);

  const [itemDesignation, setItemDesignation] = useState('');
  const [itemFournisseur, setItemFournisseur] = useState('');
  const [itemPrixTtc, setItemPrixTtc] = useState<number>(0);
  const [itemRemise, setItemRemise] = useState<number>(0);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrixAchat, setItemPrixAchat] = useState<number>(0);
  const [itemTva, setItemTva] = useState<number>(0);
  const [itemFodec, setItemFodec] = useState<number | null>(null);

  useEffect(() => {
    if (!onComposerDirtyChange) return;
    const dirty =
      itemDesignation.trim().length > 0 ||
      itemDescription.trim().length > 0 ||
      productSearch.trim().length > 0 ||
      itemQuantity !== 1 ||
      itemPrixTtc > 0 ||
      itemRemise > 0 ||
      itemPrixAchat > 0 ||
      itemFournisseur.trim().length > 0;
    onComposerDirtyChange(dirty);
  }, [
    onComposerDirtyChange,
    itemDesignation,
    itemDescription,
    productSearch,
    itemQuantity,
    itemPrixTtc,
    itemRemise,
    itemPrixAchat,
    itemFournisseur,
  ]);

  useEffect(() => {
    setItemFodec(null);
  }, [itemPrixTtc, itemRemise, itemQuantity]);

  const loadPrixAchatFromInventoryProduct = useCallback(
    (product: { id: number; name?: string; product_group_id?: number | null; fournisseur?: string | null }) => {
      const req = ++achatPriceRequestRef.current;

      void (async () => {
        const { data: prow } = await supabase
          .from('products')
          .select('product_group_id, name, fournisseur, price')
          .eq('id', product.id)
          .maybeSingle();

        if (achatPriceRequestRef.current !== req) return;

        let groupId = product.product_group_id ?? prow?.product_group_id ?? null;
        const prodName = (prow?.name || product.name || '').trim();
        if (!groupId && prodName) {
          const { data: glist } = await supabase.from('product_groups').select('id').eq('name', prodName).limit(1);
          if (achatPriceRequestRef.current !== req) return;
          groupId = glist?.[0]?.id ?? null;
        }
        if (!groupId) {
          const fromVariantNoGroup = prixAchatHtFromVariantProduct(prow?.price);
          if (fromVariantNoGroup !== undefined) setItemPrixAchat(fromVariantNoGroup);
          return;
        }

        const { data, error } = await supabase
          .from('product_group_fournisseurs')
          .select('prix_ttc, fournisseur_name')
          .eq('product_group_id', groupId);

        if (achatPriceRequestRef.current !== req) return;
        if (error) {
          console.warn('[useDevisCatalogSearch] prix achat (fournisseurs):', error.message);
          const fromVariantOnErr = prixAchatHtFromVariantProduct(prow?.price);
          if (fromVariantOnErr !== undefined) setItemPrixAchat(fromVariantOnErr);
          return;
        }
        const fournLabel = prow?.fournisseur ?? product.fournisseur;
        const n = pickPrixAchatHtFromFournisseurRows(data || [], fournLabel);
        if (n !== undefined) {
          setItemPrixAchat(n);
          return;
        }
        const fromVariant = prixAchatHtFromVariantProduct(prow?.price);
        if (fromVariant !== undefined) setItemPrixAchat(fromVariant);
      })();
    },
    []
  );

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      return;
    }
    if (selectedProduct) {
      const label = `${selectedProduct.sku} — ${selectedProduct.name}`.trim();
      if (debouncedSearch.trim() === label) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
    }
    let cancelled = false;
    const search = async () => {
      setIsSearching(true);
      const rows = await searchInventoryProductsLight({
        searchTerm: debouncedSearch,
        perBranchLimit: 120,
        maxResults: 150,
        fournisseurExact: isAchat && thirdPartyName.trim() ? thirdPartyName.trim() : null,
      });
      if (cancelled) return;
      setSearchResults(rows.map(mapLightRowToProduct));
      setIsSearching(false);
    };
    void search();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, isAchat, thirdPartyName, selectedProduct]);

  const selectExistingProduct = useCallback(
    (product: Product) => {
      achatPriceRequestRef.current += 1;
      setSelectedProduct(product);
      setItemDesignation(product.name);
      setItemFournisseur(product.fournisseur || '');
      if (isAchat) {
        const priceHt = product.price || 0;
        setItemPrixTtc(priceHt);
        setItemPrixAchat(0);
        setItemRemise(product.remise || 0);
      } else {
        const p = Number(product.price);
        const r = Number(product.remise ?? 0);
        const netHt = Number.isFinite(p) ? p * (1 - (Number.isFinite(r) ? r : 0) / 100) : 0;
        setItemPrixTtc(0);
        const achatFromSearch =
          typeof product.prix_achat_ht === 'number' && Number.isFinite(product.prix_achat_ht)
            ? product.prix_achat_ht
            : undefined;
        const achat =
          Number.isFinite(netHt) && netHt > 0
            ? netHt
            : achatFromSearch ?? prixAchatHtFromVariantProduct(product.price) ?? 0;
        setItemPrixAchat(achat);
        setItemRemise(0);
        if (achat <= 0) loadPrixAchatFromInventoryProduct(product);
      }
      setItemQuantity(1);
      setItemDescription('');
      setProductSearch(`${product.sku} — ${product.name}`.trim());
      setSearchResults([]);
    },
    [isAchat, loadPrixAchatFromInventoryProduct]
  );

  const clearCatalogSelection = useCallback(() => {
    achatPriceRequestRef.current += 1;
    setSelectedProduct(null);
    setItemDesignation('');
    setItemFournisseur('');
    setItemPrixTtc(0);
    setItemRemise(0);
    setItemQuantity(1);
    setItemDescription('');
    setItemPrixAchat(0);
    setItemTva(0);
    setProductSearch('');
    setSearchResults([]);
  }, []);

  const resetComposerLine = useCallback(() => {
    clearCatalogSelection();
    setItemFodec(null);
  }, [clearCatalogSelection]);

  const cancelPendingAchatPriceLoad = useCallback(() => {
    achatPriceRequestRef.current += 1;
  }, []);

  return {
    articleMode,
    setArticleMode,
    productSearch,
    setProductSearch,
    searchResults,
    setSearchResults,
    isSearching,
    selectedProduct,
    setSelectedProduct,
    composerSearchRef,
    itemDesignation,
    setItemDesignation,
    itemFournisseur,
    setItemFournisseur,
    itemPrixTtc,
    setItemPrixTtc,
    itemRemise,
    setItemRemise,
    itemQuantity,
    setItemQuantity,
    itemDescription,
    setItemDescription,
    itemPrixAchat,
    setItemPrixAchat,
    itemTva,
    setItemTva,
    itemFodec,
    setItemFodec,
    loadPrixAchatFromInventoryProduct,
    selectExistingProduct,
    clearCatalogSelection,
    resetComposerLine,
    cancelPendingAchatPriceLoad,
  };
}
