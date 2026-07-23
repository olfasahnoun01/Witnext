import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { computeDevisTotals } from '@/lib/devisPricing';
import {
  applyPartyTvaPolicyToItems,
  defaultDevisLineTvaForParty,
  defaultDevisPricingModeIsTtc,
  isPartyExonereDeTva,
  type DevisFormCommitOptions,
} from '@/lib/devisTvaPolicy';
import { type ClientTvaStatus } from '@/config/sectionThemes';
import { Devis, DevisItem, Product } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatPhonesDisplay } from '@/lib/phoneList';
import {
  useDevisCatalogSearch,
  useDevisParties,
  type DevisFormProps,
  type DevisPartyClient,
  type DevisPartyFournisseur,
} from '@/modules/commercial/quotations';
import { useDevisNewPartyDialogs } from '@/modules/commercial/quotations/hooks/useDevisNewPartyDialogs';
import { useDevisArticleDialogs } from '@/modules/commercial/quotations/hooks/useDevisArticleDialogs';
import { DevisFormArticlesSection } from '@/modules/commercial/quotations/components/DevisFormArticlesSection';
import { DevisFormDialogs } from '@/modules/commercial/quotations/components/DevisFormDialogs';
import { DevisFormNotesSection } from '@/modules/commercial/quotations/components/DevisFormNotesSection';
import { DevisFormSettingsHeader } from '@/modules/commercial/quotations/components/DevisFormSettingsHeader';
import { DevisZohoFooter, DevisZohoShell } from './DevisFormUi';
import { DevisPartyFieldsTable } from './DevisPartyFieldsTable';
import { ImportDevisIntoBcPanel } from './ImportDevisIntoBcPanel';
import { BcFournisseurPdfReader } from './BcFournisseurPdfReader';
import type { BcFournisseurPdfImportResult } from '@/lib/devisPdfImport';
import { useAppLayout } from '@/contexts/AppLayoutContext';

export const DevisForm = memo(({
  devisType, devisNumber, devisDate,
  thirdPartyName, thirdPartyAddress, thirdPartyTaxId, thirdPartyPhone,
  notes, documentStatus, devisItems, editingDevis, isSaving, isTtc, isFodecEnabled,
  setDevisType, setDevisNumber, setDevisDate,
  setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setThirdPartyPhone,
  setNotes, setDocumentStatus, setDevisItems, setIsTtc, setIsFodecEnabled,
  draftSavedAt,
  onSave, onUpdate, onCancel,
  docType, setDocType, lockDevisType, forceDocType,
  existingAttachments = [],
  pendingAttachmentFiles = [],
  onPendingAttachmentFilesChange,
  onRemoveExistingAttachment,
  importableDevis = [],
  onImportDevis,
  onComposerDirtyChange,
}: DevisFormProps) => {
  const { sidebarOpen } = useAppLayout();
  const partyTvaPolicyKeyRef = useRef<string | null>(null);
  const hydratedEditIdRef = useRef<number | string | null>(null);

  const {
    isAchat,
    fournisseurs,
    setFournisseurs,
    clients,
    setClients,
    selectedThirdPartyId,
    setSelectedThirdPartyId,
    dbCategories,
    handleThirdPartyNameChange,
  } = useDevisParties({
    devisType,
    setThirdPartyName,
    setThirdPartyAddress,
    setThirdPartyTaxId,
    setThirdPartyPhone,
  });

  const catalog = useDevisCatalogSearch({
    devisType,
    thirdPartyName,
    onComposerDirtyChange,
  });

  const {
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
    selectExistingProduct: selectExistingProductBase,
    clearCatalogSelection,
    cancelPendingAchatPriceLoad,
  } = catalog;

  const selectExistingProduct = useCallback(
    (product: Product) => {
      selectExistingProductBase(product);
      if (isAchat && product.subject_to_fodec) {
        setIsFodecEnabled(true);
        setItemFodec(null);
      } else if (isAchat && isFodecEnabled && !product.subject_to_fodec) {
        // Keep document FODEC on, but this line must not get 1 %
        setItemFodec(0);
      }
    },
    [
      selectExistingProductBase,
      isAchat,
      isFodecEnabled,
      setIsFodecEnabled,
      setItemFodec,
    ]
  );

  const filteredThirdParties = useMemo(() => {
    const query = thirdPartyName.trim().toLowerCase();
    if (!query) return [];
    const list = isAchat ? fournisseurs : clients;
    return list
      .filter((item) => {
        const normalizedName = item.nom.trim().toLowerCase();
        return normalizedName.includes(query) && normalizedName !== query;
      })
      .slice(0, 8);
  }, [isAchat, fournisseurs, clients, thirdPartyName]);

  const thirdPartyTvaStatus = useMemo((): ClientTvaStatus | null => {
    const trimmed = thirdPartyName.trim();
    if (!trimmed) return null;
    const list = isAchat ? fournisseurs : clients;
    const match =
      (selectedThirdPartyId
        ? list.find((item) => item.id.toString() === selectedThirdPartyId)
        : undefined) ??
      list.find((item) => item.nom.trim().toLowerCase() === trimmed.toLowerCase());
    if (!match) return 'assujetti';
    if (isAchat) return 'assujetti';
    return ((match as DevisPartyClient).tva_status as ClientTvaStatus) || 'assujetti';
  }, [isAchat, fournisseurs, clients, thirdPartyName, selectedThirdPartyId]);

  const partyExonereDeTva = isPartyExonereDeTva(thirdPartyTvaStatus);

  const {
    openNewFournisseurDialog,
    openNewClientDialog,
    fournisseurDialogProps,
    clientDialogProps,
    documentPreview,
    pdfBytesRef,
    closeDocumentPreview,
  } = useDevisNewPartyDialogs({
    isAchat,
    thirdPartyName,
    thirdPartyAddress,
    thirdPartyTaxId,
    thirdPartyPhone,
    thirdPartyTvaStatus,
    clients,
    fournisseurs,
    setClients,
    setFournisseurs,
    setSelectedThirdPartyId,
    setThirdPartyName,
    setThirdPartyAddress,
    setThirdPartyTaxId,
    setThirdPartyPhone,
    partyTvaPolicyKeyRef,
  });

  const { openNewArticleDialog, openAddVariantDialog, newArticleDialogProps, addVariantDialogProps } =
    useDevisArticleDialogs({
      devisType,
      dbCategories,
      setDevisItems,
      setItemDesignation,
      setItemFournisseur,
      setItemPrixTtc,
      setItemRemise,
      setItemQuantity,
      setItemDescription,
      setItemPrixAchat,
      setSelectedProduct,
      loadPrixAchatFromInventoryProduct: catalog.loadPrixAchatFromInventoryProduct,
    });

  const handlePricingModeChange = useCallback(
    (nextTtc: boolean) => {
      if (partyExonereDeTva && nextTtc) return;
      setIsTtc(nextTtc);
    },
    [partyExonereDeTva, setIsTtc]
  );

  useEffect(() => {
    if (!thirdPartyName.trim() || thirdPartyTvaStatus == null) return;

    const editId = editingDevis?.id ?? null;
    const isEditHydrate = editId != null && hydratedEditIdRef.current !== editId;

    const policyKey = `${devisType}|${selectedThirdPartyId}|${thirdPartyName.trim().toLowerCase()}|${thirdPartyTvaStatus}`;
    if (!isEditHydrate && partyTvaPolicyKeyRef.current === policyKey) return;

    if (isEditHydrate) {
      hydratedEditIdRef.current = editId;
      partyTvaPolicyKeyRef.current = policyKey;
      if (isPartyExonereDeTva(thirdPartyTvaStatus)) {
        setDevisItems((prev) => applyPartyTvaPolicyToItems(prev, thirdPartyTvaStatus));
        setIsTtc(false);
      }
      return;
    }

    partyTvaPolicyKeyRef.current = policyKey;
    setItemTva(defaultDevisLineTvaForParty(thirdPartyTvaStatus));
    setDevisItems((prev) => applyPartyTvaPolicyToItems(prev, thirdPartyTvaStatus));
    setIsTtc(defaultDevisPricingModeIsTtc(thirdPartyTvaStatus));
  }, [thirdPartyTvaStatus, thirdPartyName, selectedThirdPartyId, devisType, setDevisItems, setIsTtc, editingDevis, setItemTva]);

  useEffect(() => {
    if (partyExonereDeTva && isTtc) setIsTtc(false);
  }, [partyExonereDeTva, isTtc, setIsTtc]);

  useEffect(() => {
    if (editingDevis?.id == null) {
      hydratedEditIdRef.current = null;
      partyTvaPolicyKeyRef.current = null;
    }
  }, [devisType, editingDevis?.id]);

  const handleThirdPartySuggestionSelect = useCallback(
    (item: DevisPartyFournisseur | DevisPartyClient) => {
      setThirdPartyName(item.nom);
      setThirdPartyAddress(item.location || '');
      setThirdPartyTaxId(item.matricule_fiscale || '');
      setThirdPartyPhone(formatPhonesDisplay(item.phone) || '');
      setSelectedThirdPartyId(item.id.toString());
    },
    [setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setThirdPartyPhone, setSelectedThirdPartyId]
  );

  const handleArticleModeSelect = useCallback(
    (mode: 'search' | 'manual') => {
      cancelPendingAchatPriceLoad();
      const keepName = itemDesignation.trim() || productSearch.trim();
      setArticleMode(mode);
      setSelectedProduct(null);
      if (keepName) {
        setItemDesignation(keepName);
        if (mode === 'search') setProductSearch(keepName);
      } else {
        setProductSearch('');
        setSearchResults([]);
      }
      setItemFournisseur('');
      setItemPrixTtc(0);
      setItemDescription('');
    },
    [
      cancelPendingAchatPriceLoad,
      itemDesignation,
      productSearch,
      setArticleMode,
      setSelectedProduct,
      setItemDesignation,
      setProductSearch,
      setSearchResults,
      setItemFournisseur,
      setItemPrixTtc,
      setItemDescription,
    ]
  );

  const handleFournisseurPdfImportApply = useCallback(
    (result: BcFournisseurPdfImportResult) => {
      setDevisItems(result.items);
      setArticleMode('manual');

      if (result.supplier) {
        setThirdPartyName(result.supplier.nom);
        setSelectedThirdPartyId(result.supplier.id.toString());
      } else if (result.header.supplierName) {
        handleThirdPartyNameChange(result.header.supplierName);
      }

      if (result.header.taxId) setThirdPartyTaxId(result.header.taxId);
      else if (result.supplier?.matricule_fiscale) setThirdPartyTaxId(result.supplier.matricule_fiscale);

      if (result.header.phone) setThirdPartyPhone(result.header.phone);
      else if (result.supplier?.phone) setThirdPartyPhone(formatPhonesDisplay(result.supplier.phone));

      if (result.header.address) setThirdPartyAddress(result.header.address);
      else if (result.supplier?.location) setThirdPartyAddress(result.supplier.location);

      if (result.header.documentDate) setDevisDate(result.header.documentDate);
      if (result.items.some((item) => (item.tva ?? 0) > 0)) setIsTtc(true);
      onPendingAttachmentFilesChange?.([result.sourceFile]);
      onComposerDirtyChange?.(true);
      const label = docType === 'bc' || forceDocType === 'bc' ? 'BC' : 'devis';
      toast.success(`${label} prérempli depuis le devis fournisseur`);
    },
    [
      setDevisItems,
      setArticleMode,
      setDevisDate,
      setIsTtc,
      handleThirdPartyNameChange,
      setThirdPartyName,
      setThirdPartyAddress,
      setThirdPartyTaxId,
      setThirdPartyPhone,
      setSelectedThirdPartyId,
      onPendingAttachmentFilesChange,
      onComposerDirtyChange,
      docType,
      forceDocType,
    ]
  );

  const showFournisseurPdfReader =
    isAchat &&
    !editingDevis &&
    (docType === 'devis' || docType === 'bc' || forceDocType === 'devis' || forceDocType === 'bc');

  const fournisseurPdfTargetDocType: 'devis' | 'bc' =
    docType === 'bc' || forceDocType === 'bc' ? 'bc' : 'devis';

  const buildCommitOptions = useCallback((): DevisFormCommitOptions | undefined => {
    if (isAchat || !thirdPartyTvaStatus) return undefined;
    return {
      items: applyPartyTvaPolicyToItems(devisItems, thirdPartyTvaStatus),
      isTtc: isPartyExonereDeTva(thirdPartyTvaStatus) ? false : isTtc,
      partyTvaStatus: thirdPartyTvaStatus,
    };
  }, [isAchat, thirdPartyTvaStatus, devisItems, isTtc]);

  const handleSave = useCallback(() => {
    const commit = buildCommitOptions();
    if (commit) {
      setDevisItems(commit.items);
      setIsTtc(commit.isTtc);
    }
    onSave(commit);
  }, [buildCommitOptions, onSave, setDevisItems, setIsTtc]);

  const handleUpdate = useCallback(() => {
    onUpdate(buildCommitOptions());
  }, [buildCommitOptions, onUpdate]);

  const addItem = useCallback(() => {
    if (articleMode === 'search') {
      if (!selectedProduct) {
        toast.error('Sélectionnez un article dans le catalogue');
        return;
      }
    } else if (!itemDesignation.trim()) {
      toast.error("Nom d'article requis");
      return;
    }
    if (devisType === 'vente' && itemPrixTtc <= 0) {
      toast.error('Indiquez le prix de vente HT');
      return;
    }

    const detailDescription = itemDescription.trim();
    const catalogSku = selectedProduct?.sku?.trim();
    const showFodecColumn = isAchat && isFodecEnabled && !partyExonereDeTva;
    let fodecExtra: { fodec?: number } = {};
    if (showFodecColumn) {
      if (itemFodec !== null) {
        fodecExtra = { fodec: itemFodec };
      } else if (articleMode === 'search' && selectedProduct && !selectedProduct.subject_to_fodec) {
        fodecExtra = { fodec: 0 };
      }
      // subject_to_fodec product with itemFodec null → omit fodec → auto 1 % of line HT
    }

    const newItems: DevisItem[] =
      articleMode === 'search' && selectedProduct
        ? [
            {
              line_id: Math.random().toString(36).substring(7),
              designation: selectedProduct.name,
              fournisseur: selectedProduct.fournisseur?.trim() || itemFournisseur.trim(),
              prix_ttc: itemPrixTtc,
              remise: itemRemise,
              quantity: itemQuantity,
              description: detailDescription || undefined,
              tva: itemTva,
              ...(catalogSku ? { sku: catalogSku } : {}),
              product_id: selectedProduct.id,
              ...(devisType === 'vente' ? { prix_achat: itemPrixAchat } : {}),
              ...fodecExtra,
            },
          ]
        : itemDesignation
            .split(',')
            .map((d) => d.trim())
            .filter((d) => d !== '')
            .map((name) => ({
              line_id: Math.random().toString(36).substring(7),
              designation: name,
              fournisseur:
                articleMode === 'manual' && isAchat ? thirdPartyName.trim() : itemFournisseur.trim(),
              prix_ttc: itemPrixTtc,
              remise: itemRemise,
              quantity: itemQuantity,
              description: detailDescription || undefined,
              tva: itemTva,
              ...(devisType === 'vente' ? { prix_achat: itemPrixAchat } : {}),
              ...fodecExtra,
            }));

    setDevisItems((prev) => [...prev, ...newItems]);
    clearCatalogSelection();
    cancelPendingAchatPriceLoad();
    if (articleMode === 'search') {
      requestAnimationFrame(() => composerSearchRef.current?.focus());
    }
  }, [
    articleMode,
    selectedProduct,
    itemDesignation,
    devisType,
    itemPrixTtc,
    itemDescription,
    isAchat,
    isFodecEnabled,
    partyExonereDeTva,
    itemFodec,
    itemFournisseur,
    itemRemise,
    itemQuantity,
    itemTva,
    itemPrixAchat,
    thirdPartyName,
    setDevisItems,
    clearCatalogSelection,
    cancelPendingAchatPriceLoad,
    composerSearchRef,
  ]);

  const removeItem = useCallback(
    (idx: number) => {
      setDevisItems((prev) => prev.filter((_, i) => i !== idx));
    },
    [setDevisItems]
  );

  const updateLineItem = useCallback(
    (idx: number, patch: Partial<DevisItem>) => {
      setDevisItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    },
    [setDevisItems]
  );

  const handleSaveDraft = useCallback(() => {
    setDocumentStatus('brouillon');
    requestAnimationFrame(() => handleSave());
  }, [setDocumentStatus, handleSave]);

  const devisTotals = useMemo(
    () =>
      computeDevisTotals(devisItems, false, {
        devisType,
        docType,
        isTvaEnabled: isTtc && !partyExonereDeTva,
        isFodecEnabled,
      }),
    [devisItems, devisType, docType, isTtc, isFodecEnabled, partyExonereDeTva]
  );

  const thirdPartyLabel = isAchat ? 'Fournisseur' : 'Client';
  const savePrimaryLabel = docType === 'bc' ? 'Enregistrer le bon de commande' : 'Enregistrer le devis';
  const canCommitComposerLine =
    articleMode === 'search'
      ? Boolean(selectedProduct) && (devisType !== 'vente' || itemPrixTtc > 0)
      : Boolean(itemDesignation.trim()) && (devisType !== 'vente' || itemPrixTtc > 0);

  const accentTone = isAchat ? 'achat' : 'vente';

  return (
    <>
      <div className={cn('w-full max-w-none space-y-4', !sidebarOpen && 'px-0')}>
        {/* Document settings */}
        <DevisZohoShell className="w-full">
          <DevisFormSettingsHeader
            editingDevis={editingDevis}
            forceDocType={forceDocType}
            lockDevisType={lockDevisType}
            docType={docType}
            setDocType={setDocType}
            devisType={devisType}
            setDevisType={setDevisType}
            isAchat={isAchat}
            partyExonereDeTva={partyExonereDeTva}
            thirdPartyTvaStatus={thirdPartyTvaStatus}
            isTtc={isTtc}
            onPricingModeChange={handlePricingModeChange}
            isFodecEnabled={isFodecEnabled}
            setIsFodecEnabled={setIsFodecEnabled}
            draftSavedAt={draftSavedAt}
          />
        </DevisZohoShell>

        {/* Client / fournisseur — bloc séparé */}
        <DevisPartyFieldsTable
          partyLabel={thirdPartyLabel}
          thirdPartyName={thirdPartyName}
          onThirdPartyNameChange={handleThirdPartyNameChange}
          suggestions={filteredThirdParties}
          onSuggestionSelect={handleThirdPartySuggestionSelect}
          devisNumber={devisNumber}
          onDevisNumberChange={setDevisNumber}
          devisDate={devisDate}
          onDevisDateChange={setDevisDate}
          thirdPartyPhone={thirdPartyPhone}
          onThirdPartyPhoneChange={setThirdPartyPhone}
          thirdPartyTaxId={thirdPartyTaxId}
          onThirdPartyTaxIdChange={setThirdPartyTaxId}
          thirdPartyAddress={thirdPartyAddress}
          onThirdPartyAddressChange={setThirdPartyAddress}
          docType={docType}
          documentStatus={documentStatus}
          onDocumentStatusChange={(v) => setDocumentStatus(v)}
          showNewParty
          onNewParty={() => (isAchat ? openNewFournisseurDialog() : openNewClientDialog())}
          newPartyTitle={isAchat ? 'Nouveau fournisseur' : 'Nouveau client'}
        />

        {showFournisseurPdfReader && (
          <div className="rounded-xl border-2 border-orange-500/30 overflow-hidden">
            <BcFournisseurPdfReader
              fournisseurs={fournisseurs}
              targetDocType={fournisseurPdfTargetDocType}
              disabled={isSaving}
              existingItemCount={devisItems.length}
              onApply={handleFournisseurPdfImportApply}
            />
          </div>
        )}

        {/* Import devis → BC — bloc séparé */}
        {(docType === 'bc' || forceDocType === 'bc') && !editingDevis && onImportDevis && (
          <ImportDevisIntoBcPanel
            devisList={importableDevis}
            onImport={onImportDevis}
            disabled={isSaving}
            tone={accentTone}
          />
        )}

        {/* Tableau articles — contenu principal pleine largeur */}
        <DevisZohoShell className="w-full">
          <DevisFormArticlesSection
            isAchat={isAchat}
            devisType={devisType}
            isFodecEnabled={isFodecEnabled}
            partyExonereDeTva={partyExonereDeTva}
            isTtc={isTtc}
            devisItems={devisItems}
            articleMode={articleMode}
            onArticleModeSelect={handleArticleModeSelect}
            onOpenAddVariant={openAddVariantDialog}
            onOpenNewArticle={openNewArticleDialog}
            composerSearchRef={composerSearchRef}
            onUpdateLine={updateLineItem}
            onRemoveLine={removeItem}
            onCommitLine={addItem}
            canCommitLine={canCommitComposerLine}
            productSearch={productSearch}
            onProductSearchChange={setProductSearch}
            searchResults={searchResults}
            isSearching={isSearching}
            selectedProduct={selectedProduct}
            onSelectProduct={selectExistingProduct}
            onClearProduct={clearCatalogSelection}
            itemDesignation={itemDesignation}
            onItemDesignationChange={setItemDesignation}
            itemDescription={itemDescription}
            onItemDescriptionChange={setItemDescription}
            itemQuantity={itemQuantity}
            onItemQuantityChange={setItemQuantity}
            itemPrixAchat={itemPrixAchat}
            onItemPrixAchatChange={setItemPrixAchat}
            itemPrixTtc={itemPrixTtc}
            onItemPrixTtcChange={setItemPrixTtc}
            itemRemise={itemRemise}
            onItemRemiseChange={setItemRemise}
            itemTva={itemTva}
            onItemTvaChange={setItemTva}
            itemFodec={itemFodec}
            onItemFodecChange={setItemFodec}
          />

          <DevisFormNotesSection
            notes={notes}
            onNotesChange={setNotes}
            docType={docType}
            existingAttachments={existingAttachments}
            pendingAttachmentFiles={pendingAttachmentFiles}
            onPendingAttachmentFilesChange={onPendingAttachmentFilesChange}
            onRemoveExistingAttachment={onRemoveExistingAttachment}
            isSaving={isSaving}
            devisTotals={devisTotals}
            showTva={isTtc && !partyExonereDeTva}
          />

          <DevisZohoFooter
            editing={Boolean(editingDevis)}
            isSaving={isSaving}
            onCancel={onCancel}
            onSave={handleSave}
            onUpdate={handleUpdate}
            onSaveDraft={!editingDevis ? handleSaveDraft : undefined}
            saveLabel={savePrimaryLabel}
            draftSavedAt={draftSavedAt}
          />
        </DevisZohoShell>
      </div>

      <DevisFormDialogs
        fournisseurDialogProps={fournisseurDialogProps}
        clientDialogProps={clientDialogProps}
        newArticleDialogProps={newArticleDialogProps}
        addVariantDialogProps={addVariantDialogProps}
        documentPreview={documentPreview}
        pdfBytesRef={pdfBytesRef}
        closeDocumentPreview={closeDocumentPreview}
      />
    </>
  );
});

DevisForm.displayName = 'DevisForm';
