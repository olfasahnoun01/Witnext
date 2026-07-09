import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createVariant } from '@/services/productGroupService';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { buildCompanyStoragePath } from '@/lib/storagePaths';
import { validateUploadFile } from '@/lib/uploadValidation';
import {
  DEVIS_ARTICLE_COLORS,
  DEVIS_ARTICLE_SIZES,
} from '@/modules/commercial/quotations/lib/devisFormConstants';
import type { DevisItem, Product, ProductGroupFournisseur } from '@/types';

type NewArticleState = {
  name: string;
  sku: string;
  category: string;
  size: string;
  quantity: number;
  min_stock: number;
  image: string | null;
  color: string;
};

type ProductGroupRow = {
  id: number;
  name: string;
  base_sku: string | null;
  category: string;
  fournisseur: string | null;
};

export type UseDevisArticleDialogsArgs = {
  devisType: 'achat' | 'vente';
  dbCategories: string[];
  setDevisItems: Dispatch<SetStateAction<DevisItem[]>>;
  setItemDesignation: Dispatch<SetStateAction<string>>;
  setItemFournisseur: Dispatch<SetStateAction<string>>;
  setItemPrixTtc: Dispatch<SetStateAction<number>>;
  setItemRemise: Dispatch<SetStateAction<number>>;
  setItemQuantity: Dispatch<SetStateAction<number>>;
  setItemDescription: Dispatch<SetStateAction<string>>;
  setItemPrixAchat: Dispatch<SetStateAction<number>>;
  setSelectedProduct: Dispatch<SetStateAction<Product | null>>;
  loadPrixAchatFromInventoryProduct: (product: {
    id: number;
    name?: string;
    product_group_id?: number | null;
    fournisseur?: string | null;
  }) => void;
};

export type NewArticleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newArticle: NewArticleState;
  setNewArticle: Dispatch<SetStateAction<NewArticleState>>;
  newArticleFournisseurs: ProductGroupFournisseur[];
  setNewArticleFournisseurs: Dispatch<SetStateAction<ProductGroupFournisseur[]>>;
  newArticleFicheFiles: File[];
  setNewArticleFicheFiles: Dispatch<SetStateAction<File[]>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  newArticleFicheRef: RefObject<HTMLInputElement | null>;
  handleArticleImageUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  resetNewArticleForm: () => void;
  createNewArticle: () => Promise<void>;
  isCreatingArticle: boolean;
  dbCategories: string[];
  sizes: readonly string[];
  colors: readonly string[];
};

export type AddVariantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productGroups: ProductGroupRow[];
  selectedGroupId: string;
  setSelectedGroupId: Dispatch<SetStateAction<string>>;
  variantSku: string;
  setVariantSku: Dispatch<SetStateAction<string>>;
  variantSize: string;
  setVariantSize: Dispatch<SetStateAction<string>>;
  variantColor: string;
  setVariantColor: Dispatch<SetStateAction<string>>;
  variantQuantity: number;
  setVariantQuantity: Dispatch<SetStateAction<number>>;
  groupSearch: string;
  setGroupSearch: Dispatch<SetStateAction<string>>;
  groupPopoverOpen: boolean;
  setGroupPopoverOpen: Dispatch<SetStateAction<boolean>>;
  filteredGroups: ProductGroupRow[];
  variantFicheFiles: File[];
  setVariantFicheFiles: Dispatch<SetStateAction<File[]>>;
  variantFicheRef: RefObject<HTMLInputElement | null>;
  handleCreateVariant: () => Promise<void>;
  isCreatingVariant: boolean;
  sizes: readonly string[];
  colors: readonly string[];
};

export function useDevisArticleDialogs({
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
  loadPrixAchatFromInventoryProduct,
}: UseDevisArticleDialogsArgs) {
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [newArticle, setNewArticle] = useState<NewArticleState>({
    name: '',
    sku: '',
    category: '',
    size: '',
    quantity: 0,
    min_stock: 5,
    image: null,
    color: '',
  });
  const [newArticleFournisseurs, setNewArticleFournisseurs] = useState<ProductGroupFournisseur[]>([]);
  const [isCreatingArticle, setIsCreatingArticle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newArticleFicheFiles, setNewArticleFicheFiles] = useState<File[]>([]);
  const newArticleFicheRef = useRef<HTMLInputElement>(null);

  const [showAddVariant, setShowAddVariant] = useState(false);
  const [productGroups, setProductGroups] = useState<ProductGroupRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [variantSize, setVariantSize] = useState('');
  const [variantColor, setVariantColor] = useState('');
  const [variantQuantity, setVariantQuantity] = useState(0);
  const [variantPrice, setVariantPrice] = useState(0);
  const [variantRemise, setVariantRemise] = useState(0);
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [variantFicheFiles, setVariantFicheFiles] = useState<File[]>([]);
  const variantFicheRef = useRef<HTMLInputElement>(null);
  const [lastVariantFullSku, setLastVariantFullSku] = useState('');

  const openNewArticleDialog = useCallback(() => {
    setShowNewArticle(true);
  }, []);

  const openAddVariantDialog = useCallback(() => {
    setShowAddVariant(true);
  }, []);

  const resetNewArticleForm = useCallback(() => {
    setNewArticle({
      name: '',
      sku: '',
      category: '',
      size: '',
      quantity: 0,
      min_stock: 5,
      image: null,
      color: '',
    });
    setNewArticleFournisseurs([]);
    setNewArticleFicheFiles([]);
  }, []);

  const handleArticleImageUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { compressImage } = await import('@/lib/imageCompression');
        const compressed = await compressImage(file);
        setNewArticle((prev) => ({ ...prev, image: compressed }));
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d')?.drawImage(img, 0, 0);
            setNewArticle((prev) => ({ ...prev, image: canvas.toDataURL('image/jpeg', 1.0) }));
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const createNewArticle = useCallback(async () => {
    if (!newArticle.name.trim()) {
      toast.error('Nom requis');
      return;
    }
    if (!newArticle.sku.trim()) {
      toast.error('Code article requis');
      return;
    }
    setIsCreatingArticle(true);
    try {
      const articleCompanyId = getActiveCompanyId();
      const existingFournQuery = supabase.from('fournisseurs').select('nom');
      const { data: existingFourns } = await (articleCompanyId
        ? existingFournQuery.eq('company_id', articleCompanyId)
        : existingFournQuery);
      const existingNames = new Set((existingFourns || []).map((f) => f.nom.toLowerCase()));

      const newFournisseurEntries = newArticleFournisseurs.filter(
        (f) => f.fournisseur_name.trim() && !existingNames.has(f.fournisseur_name.trim().toLowerCase())
      );

      if (newFournisseurEntries.length > 0) {
        await supabase.from('fournisseurs').insert(
          newFournisseurEntries.map((f) => ({
            nom: f.fournisseur_name.trim(),
            specialite: newArticle.category || 'Non catégorisé',
            company_id: articleCompanyId || undefined,
            phone: f.phone?.trim() || null,
          })) as any
        );
      }

      const primaryFournisseur = newArticleFournisseurs.length > 0 ? newArticleFournisseurs[0] : null;

      const { data: pgData, error: pgError } = await supabase
        .from('product_groups')
        .insert({
          name: newArticle.name.trim(),
          base_sku: newArticle.sku.trim(),
          category: newArticle.category || 'Non catégorisé',
          fournisseur: primaryFournisseur?.fournisseur_name || null,
          min_stock: newArticle.min_stock,
          image: newArticle.image,
          company_id: articleCompanyId || undefined,
        } as any)
        .select()
        .single();

      if (pgError) {
        toast.error('Erreur création groupe');
        return;
      }

      if (newArticleFournisseurs.length > 0 && pgData) {
        await supabase.from('product_group_fournisseurs').insert(
          newArticleFournisseurs
            .filter((f) => f.fournisseur_name.trim())
            .map((f) => ({
              product_group_id: pgData.id,
              fournisseur_name: f.fournisseur_name.trim(),
              prix_ttc: f.prix_ttc,
              fiche_technique_url: f.fiche_technique_url || null,
            }))
        );
      }

      const baseSku = newArticle.sku.trim();
      let finalBaseSku = baseSku;
      if (newArticle.size.trim()) finalBaseSku += `-${newArticle.size.trim()}`;
      if (newArticle.color.trim()) finalBaseSku += `-${newArticle.color.trim()}`;

      const productsToInsert =
        newArticleFournisseurs.length > 0
          ? newArticleFournisseurs.map((f) => ({
              name: newArticle.name.trim(),
              sku: finalBaseSku,
              category: newArticle.category || 'Non catégorisé',
              fournisseur: f.fournisseur_name || null,
              product_group_id: pgData?.id || null,
              size: newArticle.size.trim() || null,
              quantity: 0,
              price: f.prix || 0,
              remise: f.remise || 0,
              min_stock: newArticle.min_stock,
              image: newArticle.image,
              color: newArticle.color.trim() || null,
              fiche_technique_url: f.fiche_technique_url || null,
            }))
          : [
              {
                name: newArticle.name.trim(),
                sku: finalBaseSku,
                category: newArticle.category || 'Non catégorisé',
                fournisseur: null,
                product_group_id: pgData?.id || null,
                size: newArticle.size.trim() || null,
                quantity: 0,
                price: 0,
                remise: 0,
                min_stock: newArticle.min_stock,
                image: newArticle.image,
                color: newArticle.color.trim() || null,
              },
            ];

      const { data, error } = await supabase
        .from('products')
        .insert(productsToInsert.map((p) => ({ ...p, company_id: articleCompanyId || undefined })) as any)
        .select();

      if (error) {
        console.error('Product insert error:', error);
        toast.error(`Erreur création article: ${error.message}`);
      } else if (data && data.length > 0) {
        const firstVariantId = data[0].id;
        if (newArticleFicheFiles.length > 0 && firstVariantId) {
          try {
            const { convertImageFileToJpeg, convertPdfAllPagesToJpeg } = await import('@/lib/imageCompression');
            const uploadedUrls: string[] = [];

            for (const file of newArticleFicheFiles) {
              const check = validateUploadFile(file, [
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/webp',
              ]);
              if (!check.ok) {
                toast.error(check.message);
                continue;
              }
              let blobs: { blob: Blob; ext: string }[] = [];
              if (file.type === 'application/pdf') {
                blobs = await convertPdfAllPagesToJpeg(file, {
                  maxWidth: 5000,
                  maxHeight: 5000,
                  quality: 1.0,
                });
                toast.info(`PDF "${file.name}": ${blobs.length} page(s) convertie(s) en JPEG`);
              } else {
                const convResult = await convertImageFileToJpeg(file);
                blobs = [convResult];
              }
              for (const { blob, ext } of blobs) {
                const fileName = `fiche_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const filePath = buildCompanyStoragePath(`fiches/${fileName}`);
                const { error: uploadError } = await supabase.storage
                  .from('fiches-techniques')
                  .upload(filePath, blob, { contentType: 'image/jpeg' });
                if (uploadError) {
                  console.error('Storage upload error:', uploadError);
                  toast.error(`Erreur upload: ${uploadError.message}`);
                  continue;
                }
                const { data: urlData } = supabase.storage.from('fiches-techniques').getPublicUrl(filePath);
                if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);
              }
            }

            if (uploadedUrls.length > 0) {
              const fichePayload = uploadedUrls.length === 1 ? uploadedUrls[0] : JSON.stringify(uploadedUrls);
              const { error: rpcError } = await supabase.rpc('update_product_fiche_technique', {
                _product_id: firstVariantId,
                _fiche_technique_url: fichePayload,
              });
              if (rpcError) {
                console.error('RPC fiche error:', rpcError);
                toast.error(`Erreur sauvegarde fiche: ${rpcError.message}`);
              } else {
                toast.success(`${uploadedUrls.length} fiche(s) technique(s) uploadée(s)`);
              }
            }
          } catch (ficheErr) {
            console.error('Fiche technique upload error:', ficheErr);
            toast.error("Erreur lors de l'upload des fiches techniques");
          }
        }

        toast.success('Article créé avec succès');
        const first = data[0];
        const catalogDetail = (d: { size?: string; color?: string | null }) => {
          const parts = [
            d.size ? `Taille: ${d.size}` : '',
            d.color ? `Couleur: ${d.color}` : '',
          ].filter(Boolean);
          return parts.length > 0 ? parts.join(' · ') : undefined;
        };

        if (data.length > 1) {
          const newItems = data.map((d) => ({
            line_id: Math.random().toString(36).substring(7),
            designation: d.name,
            fournisseur: d.fournisseur || '',
            prix_ttc: devisType === 'vente' ? 0 : d.price || 0,
            remise: devisType === 'vente' ? 0 : d.remise || 0,
            quantity: 1,
            description: catalogDetail(d),
            sku: d.sku?.trim() || undefined,
            product_id: d.id,
          }));
          setDevisItems((prev) => [...prev, ...newItems]);
          setItemDesignation('');
          setItemFournisseur('');
          setItemPrixTtc(0);
          setItemQuantity(1);
          setItemDescription('');
          setSelectedProduct(null);
        } else {
          setItemDesignation(first.name);
          setItemFournisseur(first.fournisseur || '');
          setItemQuantity(1);
          setItemDescription(catalogDetail(first) || '');
          setSelectedProduct(first as Product);
          if (devisType === 'vente') {
            setItemPrixTtc(0);
            setItemRemise(0);
            setItemPrixAchat(0);
            loadPrixAchatFromInventoryProduct({
              id: first.id,
              name: first.name,
              product_group_id: (first as { product_group_id?: number | null }).product_group_id ?? null,
              fournisseur: first.fournisseur,
            });
          } else {
            setItemPrixTtc(first.price || 0);
            setItemRemise(first.remise || 0);
          }
        }
        setShowNewArticle(false);
        resetNewArticleForm();
      }
    } finally {
      setIsCreatingArticle(false);
    }
  }, [
    newArticle,
    newArticleFournisseurs,
    newArticleFicheFiles,
    resetNewArticleForm,
    devisType,
    loadPrixAchatFromInventoryProduct,
    setDevisItems,
    setItemDesignation,
    setItemFournisseur,
    setItemPrixTtc,
    setItemRemise,
    setItemQuantity,
    setItemDescription,
    setItemPrixAchat,
    setSelectedProduct,
  ]);

  useEffect(() => {
    if (!showAddVariant) return;
    const loadGroups = async () => {
      const { data } = await supabase
        .from('product_groups')
        .select('id, name, base_sku, category, fournisseur')
        .order('name');
      setProductGroups(data || []);
    };
    void loadGroups();
  }, [showAddVariant]);

  useEffect(() => {
    if (!selectedGroupId) {
      setLastVariantFullSku('');
      setVariantSku('');
      return;
    }
    const fetchNextSku = async () => {
      const group = productGroups.find((g) => g.id.toString() === selectedGroupId);
      const baseSku = group?.base_sku || group?.name.substring(0, 3).toUpperCase() || '';

      const { data } = await supabase
        .from('products')
        .select('sku')
        .eq('product_group_id', Number(selectedGroupId));

      if (!data || data.length === 0) {
        setLastVariantFullSku(`${baseSku}-1`);
        setVariantSku(`${baseSku}-1`);
        return;
      }

      let maxNum = 0;
      const basePattern = baseSku.toLowerCase();
      data.forEach((v) => {
        const sku = v.sku.toLowerCase();
        if (sku.startsWith(basePattern)) {
          const rest = v.sku.substring(baseSku.length);
          const match = rest.match(/^-(\d+)/);
          if (match) {
            maxNum = Math.max(maxNum, parseInt(match[1], 10));
          }
        }
      });

      const nextNum = maxNum + 1;
      const nextSku = `${baseSku}-${nextNum}`;
      setLastVariantFullSku(nextSku);
      setVariantSku(nextSku);
    };
    void fetchNextSku();
  }, [selectedGroupId, productGroups]);

  useEffect(() => {
    if (!lastVariantFullSku) return;
    let sku = lastVariantFullSku;
    if (variantSize) sku += `-${variantSize}`;
    if (variantColor) sku += `-${variantColor}`;
    setVariantSku(sku);
  }, [lastVariantFullSku, variantSize, variantColor]);

  const handleCreateVariant = useCallback(async () => {
    if (!selectedGroupId) {
      toast.error('Sélectionnez un article');
      return;
    }
    if (!variantSku.trim()) {
      toast.error('Code article requis');
      return;
    }
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('sku', variantSku.trim())
      .limit(1);
    if (existing && existing.length > 0) {
      toast.error('Ce Code Article existe déjà. Veuillez en choisir un autre.');
      return;
    }
    setIsCreatingVariant(true);
    try {
      const result = await createVariant(Number(selectedGroupId), {
        sku: variantSku.trim(),
        size: variantSize || undefined,
        color: variantColor || undefined,
        quantity: variantQuantity,
        price: variantPrice || 0,
        remise: variantRemise || 0,
      });
      if (!result.success) {
        toast.error(result.error || 'Erreur création variante');
      } else {
        if (variantFicheFiles.length > 0 && result.id) {
          try {
            const { convertImageFileToJpeg, convertPdfAllPagesToJpeg } = await import('@/lib/imageCompression');
            const uploadedUrls: string[] = [];

            for (const file of variantFicheFiles) {
              const check = validateUploadFile(file, [
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/webp',
              ]);
              if (!check.ok) {
                toast.error(check.message);
                continue;
              }
              let blobs: { blob: Blob; ext: string }[] = [];

              if (file.type === 'application/pdf') {
                blobs = await convertPdfAllPagesToJpeg(file, {
                  maxWidth: 5000,
                  maxHeight: 5000,
                  quality: 1.0,
                });
              } else {
                const convResult = await convertImageFileToJpeg(file);
                blobs = [convResult];
              }

              for (const { blob, ext } of blobs) {
                const fileName = `fiche_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const filePath = buildCompanyStoragePath(`fiches/${fileName}`);
                const { error: uploadError } = await supabase.storage
                  .from('fiches-techniques')
                  .upload(filePath, blob, { contentType: 'image/jpeg' });
                if (uploadError) {
                  console.error('Storage upload error:', uploadError);
                  toast.error(`Erreur upload: ${uploadError.message}`);
                  continue;
                }
                const { data: urlData } = supabase.storage.from('fiches-techniques').getPublicUrl(filePath);
                if (urlData?.publicUrl) {
                  uploadedUrls.push(urlData.publicUrl);
                }
              }
            }

            if (uploadedUrls.length > 0) {
              const fichePayload =
                uploadedUrls.length === 1 ? uploadedUrls[0] : JSON.stringify(uploadedUrls);

              const { error: rpcError } = await supabase.rpc('update_product_fiche_technique', {
                _product_id: result.id,
                _fiche_technique_url: fichePayload,
              });
              if (rpcError) {
                console.error('RPC fiche error:', rpcError);
                toast.error(`Erreur sauvegarde fiche: ${rpcError.message}`);
              } else {
                toast.success(`${uploadedUrls.length} fiche(s) technique(s) uploadée(s)`);
              }
            }
          } catch (e: any) {
            console.error('Fiche upload error:', e);
            toast.error(`Erreur traitement fiches: ${e.message || e}`);
          }
        }
        toast.success('Variante créée avec succès');
        const group = productGroups.find((g) => g.id.toString() === selectedGroupId);
        if (group) {
          setItemDesignation(group.name);
          setItemFournisseur(group.fournisseur || '');
          setItemDescription('');
          setSelectedProduct({
            id: result.id,
            name: group.name,
            sku: variantSku,
            price: variantPrice,
            remise: variantRemise,
            quantity: variantQuantity,
            fournisseur: group.fournisseur || '',
            product_group_id: Number(selectedGroupId),
          } as Product);
          if (devisType === 'vente') {
            setItemPrixTtc(0);
            setItemRemise(0);
            setItemPrixAchat(0);
            loadPrixAchatFromInventoryProduct({
              id: result.id,
              name: group.name,
              product_group_id: Number(selectedGroupId),
              fournisseur: group.fournisseur,
            });
          }
        }
        setShowAddVariant(false);
        setSelectedGroupId('');
        setVariantSku('');
        setVariantSize('');
        setVariantColor('');
        setVariantQuantity(0);
        setVariantPrice(0);
        setVariantRemise(0);
        setGroupSearch('');
        setVariantFicheFiles([]);
      }
    } finally {
      setIsCreatingVariant(false);
    }
  }, [
    selectedGroupId,
    variantSku,
    variantSize,
    variantColor,
    variantQuantity,
    productGroups,
    variantFicheFiles,
    devisType,
    loadPrixAchatFromInventoryProduct,
    setItemDesignation,
    setItemFournisseur,
    setItemDescription,
    setSelectedProduct,
    setItemPrixTtc,
    setItemRemise,
    setItemPrixAchat,
  ]);

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return productGroups;
    const q = groupSearch.toLowerCase();
    return productGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [productGroups, groupSearch]);

  const handleNewArticleOpenChange = useCallback(
    (open: boolean) => {
      setShowNewArticle(open);
      if (!open) resetNewArticleForm();
    },
    [resetNewArticleForm]
  );

  const handleAddVariantOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setShowAddVariant(false);
      setSelectedGroupId('');
      setVariantSku('');
      setVariantSize('');
      setVariantColor('');
      setVariantQuantity(0);
      setGroupSearch('');
    }
  }, []);

  const newArticleDialogProps: NewArticleDialogProps = {
    open: showNewArticle,
    onOpenChange: handleNewArticleOpenChange,
    newArticle,
    setNewArticle,
    newArticleFournisseurs,
    setNewArticleFournisseurs,
    newArticleFicheFiles,
    setNewArticleFicheFiles,
    fileInputRef,
    newArticleFicheRef,
    handleArticleImageUpload,
    resetNewArticleForm,
    createNewArticle,
    isCreatingArticle,
    dbCategories,
    sizes: DEVIS_ARTICLE_SIZES,
    colors: DEVIS_ARTICLE_COLORS,
  };

  const addVariantDialogProps: AddVariantDialogProps = {
    open: showAddVariant,
    onOpenChange: handleAddVariantOpenChange,
    productGroups,
    selectedGroupId,
    setSelectedGroupId,
    variantSku,
    setVariantSku,
    variantSize,
    setVariantSize,
    variantColor,
    setVariantColor,
    variantQuantity,
    setVariantQuantity,
    groupSearch,
    setGroupSearch,
    groupPopoverOpen,
    setGroupPopoverOpen,
    filteredGroups,
    variantFicheFiles,
    setVariantFicheFiles,
    variantFicheRef,
    handleCreateVariant,
    isCreatingVariant,
    sizes: DEVIS_ARTICLE_SIZES,
    colors: DEVIS_ARTICLE_COLORS,
  };

  return {
    openNewArticleDialog,
    openAddVariantDialog,
    newArticleDialogProps,
    addVariantDialogProps,
  };
}
