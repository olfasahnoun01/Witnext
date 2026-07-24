import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/components/ui/decimal-input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Plus, Trash2, FileText, Download, Save, Loader2, Search, Edit, ImagePlus, X 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Product, UnifiedDocument, UnifiedDocumentType } from '@/types';
import { documentService } from '@/modules/commercial';
import { toast } from 'sonner';
import { CategoryProductSelector } from '../shared/CategoryProductSelector';
import { LazyProductImage } from '@/components/shared/LazyProductImage';
import { downloadUnifiedDocumentPDF } from '@/utils/pdfGenerator';
import { PendingWarehouseDocument, clearPendingWarehouseDocument, readPendingWarehouseDocument } from '@/lib/appNavigationStorage';
import { getActiveCompanyIdForQuery } from '@/lib/activeCompany';
import { filterByCompanyId } from '@/modules/inventory/lib/companyQuery';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { DevisAnchoredDropdown } from '../devis/DevisAnchoredDropdown';
import { DevisSegmentedGrid, DevisSegmentedOption } from '../devis/DevisFormUi';
import { updateProduct } from '@/modules/inventory/services/productRepository';
import {
  fetchProductImageRef,
  invalidateProductImageRef,
} from '@/lib/productImageStorage';
import { cn } from '@/lib/utils';

type BlPurpose = 'client' | 'magasin_transfer';
type ArticleMode = 'search' | 'manual';
type ServiceMotif = 'impression_logo' | 'marquage_noms' | 'broderie' | 'autre';

const SERVICE_MOTIF_OPTIONS: { value: ServiceMotif; label: string }[] = [
  { value: 'impression_logo', label: 'Impression logo' },
  { value: 'marquage_noms', label: 'Marquage / impression noms' },
  { value: 'broderie', label: 'Broderie' },
  { value: 'autre', label: 'Autre façonnage' },
];

const SERVICE_MOTIF_LABELS: Record<ServiceMotif, string> = {
  impression_logo: 'Impression logo',
  marquage_noms: 'Marquage / impression noms',
  broderie: 'Broderie',
  autre: 'Autre façonnage',
};

type DocumentLine = {
  lineKey: string;
  product_id: number | null;
  product_name: string;
  /** Free-text details (sizes, colors, etc.). */
  description: string;
  sku: string;
  quantity: number;
  unit_price: number;
  /** Product photo (data URL or storage path) — warehouse docs; saved onto products.image when catalog. */
  image: string | null;
  /** True when the user uploaded/cleared the photo in this session. */
  imageDirty: boolean;
};

const MANUAL_LINE_SEP = ' — ';

/** Encode designation + details into document_lines.description (manual lines). */
function encodeManualLineDescription(name: string, details: string): string {
  const n = name.trim();
  const d = details.trim();
  if (!n) return d;
  if (!d) return n;
  return `${n}${MANUAL_LINE_SEP}${d}`;
}

/** Decode document_lines.description for a manual (no product) line. */
function decodeManualLineDescription(raw: string | null | undefined): {
  product_name: string;
  description: string;
} {
  const text = (raw ?? '').trim();
  if (!text) return { product_name: 'Article', description: '' };
  const idx = text.indexOf(MANUAL_LINE_SEP);
  if (idx < 0) return { product_name: text, description: '' };
  return {
    product_name: text.slice(0, idx).trim() || 'Article',
    description: text.slice(idx + MANUAL_LINE_SEP.length).trim(),
  };
}

type TierRecord = {
  id: number;
  nom?: string;
  raison_sociale?: string;
  adresse?: string;
  location?: string;
  matricule_fiscal?: string;
  tax_id?: string;
  telephone?: string;
  phone?: string;
};

const newLineKey = () => crypto.randomUUID();

interface DocumentCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: UnifiedDocumentType;
  onSuccess: () => void;
  initialData?: PendingWarehouseDocument | null;
  mandatory?: boolean;
  /** When set, the dialog opens in edit mode for an existing document. */
  editDocumentId?: string | null;
  /** Magasin BL tabs: lock purpose and hide the client/intermagasin radio. */
  lockedBlPurpose?: BlPurpose | null;
}

export const DocumentCreationDialog = ({
  open,
  onOpenChange,
  type,
  onSuccess,
  initialData = null,
  mandatory = false,
  editDocumentId = null,
  lockedBlPurpose = null,
}: DocumentCreationDialogProps) => {
  const { companies, currentCompany } = useAppCompany();
  const isEditMode = !!editDocumentId;
  const partyInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [editDoc, setEditDoc] = useState<UnifiedDocument | null>(null);
  const [notes, setNotes] = useState('');
  const [validity, setValidity] = useState('30 jours');
  const [transportRef, setTransportRef] = useState('');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [fournisseurId, setFournisseurId] = useState<number | null>(null);
  const [partyName, setPartyName] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [partyTaxId, setPartyTaxId] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partySuggestionsOpen, setPartySuggestionsOpen] = useState(false);
  const [blPurpose, setBlPurpose] = useState<BlPurpose>('client');
  const [serviceMotif, setServiceMotif] = useState<ServiceMotif>('impression_logo');
  const [sourceMagasin, setSourceMagasin] = useState('');
  const [destinationMagasin, setDestinationMagasin] = useState('');
  const [articleMode, setArticleMode] = useState<ArticleMode>('search');
  const [manualDesignation, setManualDesignation] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualSku, setManualSku] = useState('');
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualUnitPrice, setManualUnitPrice] = useState(0);
  
  const [clients, setClients] = useState<TierRecord[]>([]);
  const [fournisseurs, setFournisseurs] = useState<TierRecord[]>([]);
  const [lines, setLines] = useState<DocumentLine[]>([]);

  const isSupplierParty = type === 'BE' || type === 'BL_FOURNISSEUR';
  /** Hide unit price; show line photo upload instead (BE/BS + BL magasin). */
  const showLinePhoto =
    type === 'BE' || type === 'BS' || type === 'BL_CLIENT' || type === 'BL_FOURNISSEUR';
  const effectiveBlPurpose: BlPurpose = lockedBlPurpose ?? blPurpose;
  const tierList = isSupplierParty ? fournisseurs : clients;

  const tierSuggestions = useMemo(() => {
    const q = partyName.trim().toLowerCase();
    if (!q) return [];
    return tierList
      .filter((t) => {
        const name = (t.nom || t.raison_sociale || '').trim().toLowerCase();
        // Hide exact match so the list closes after a selection (same as Devis).
        return name.includes(q) && name !== q;
      })
      .slice(0, 8);
  }, [partyName, tierList]);

  const applyTierSelection = (tier: TierRecord) => {
    setPartyName(tier.nom || tier.raison_sociale || '');
    setPartyAddress(tier.adresse || tier.location || '');
    setPartyTaxId(tier.matricule_fiscal || tier.tax_id || '');
    setPartyPhone(tier.telephone || tier.phone || '');
    setPartySuggestionsOpen(false);
    if (isSupplierParty) {
      setFournisseurId(tier.id);
      setClientId(null);
    } else {
      setClientId(tier.id);
      setFournisseurId(null);
    }
  };

  const handlePartyNameChange = (value: string) => {
    setPartyName(value);
    setPartySuggestionsOpen(true);
    if (isSupplierParty) {
      setFournisseurId(null);
    } else {
      setClientId(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const tiers = await loadTiers();
      if (editDocumentId) {
        await loadDocumentForEdit(editDocumentId, tiers);
      } else if (initialData) {
        setEditDoc(null);
        setNotes(initialData.note || '');
        setValidity('30 jours');
        setTransportRef('');
        setDocumentDate(initialData.date);
        setClientId(null);
        setFournisseurId(null);
        setPartyName('');
        setPartyAddress('');
        setPartyTaxId('');
        setPartyPhone('');
        setPartySuggestionsOpen(false);
        setArticleMode('search');
        setLines([{
          lineKey: newLineKey(),
          product_id: initialData.productId,
          product_name: initialData.productName,
          description: '',
          sku: initialData.sku,
          quantity: initialData.quantity,
          unit_price: showLinePhoto ? 0 : initialData.unitPrice,
          image: null,
          imageDirty: false,
        }]);
        if (showLinePhoto && initialData.productId) {
          void fetchProductImageRef(initialData.productId).then((ref) => {
            if (!ref) return;
            setLines((prev) =>
              prev.map((l) =>
                l.product_id === initialData.productId && !l.imageDirty
                  ? { ...l, image: ref }
                  : l
              )
            );
          });
        }
      } else {
        resetForm();
      }
    })();
  }, [open, type, initialData, editDocumentId]);

  const populateFromDocument = (doc: UnifiedDocument) => {
    const meta = doc.metadata ?? {};
    setEditDoc(doc);
    setNotes(doc.notes ?? '');
    setValidity(String(meta.validity ?? '30 jours'));
    setTransportRef(String(meta.transport_ref ?? ''));
    setDocumentDate(String(meta.document_date ?? doc.created_at.split('T')[0]));
    setClientId(doc.client_id);
    setFournisseurId(doc.fournisseur_id);
    setBlPurpose(meta.bl_purpose === 'magasin_transfer' ? 'magasin_transfer' : 'client');
    const motif = String(meta.service_motif ?? 'impression_logo');
    setServiceMotif(
      (['impression_logo', 'marquage_noms', 'broderie', 'autre'] as ServiceMotif[]).includes(
        motif as ServiceMotif
      )
        ? (motif as ServiceMotif)
        : 'autre'
    );
    setSourceMagasin(String(meta.source_magasin ?? currentCompany?.name ?? ''));
    setDestinationMagasin(String(meta.destination_magasin ?? ''));
    setArticleMode('search');
    setLines(
      (doc.lines ?? []).map((line) => {
        if (line.product_id != null) {
          return {
            lineKey: String(line.id ?? newLineKey()),
            product_id: line.product_id,
            product_name: line.product_name ?? 'Article',
            description: line.description ?? '',
            sku: line.product_sku ?? '',
            quantity: line.quantity,
            unit_price: line.unit_price,
            image: null,
            imageDirty: false,
          };
        }
        const decoded = decodeManualLineDescription(line.description ?? line.product_name);
        return {
          lineKey: String(line.id ?? newLineKey()),
          product_id: null,
          product_name: decoded.product_name,
          description: decoded.description,
          sku: line.product_sku ?? '',
          quantity: line.quantity,
          unit_price: line.unit_price,
          image: null,
          imageDirty: false,
        };
      })
    );
    // Prefetch product photos for warehouse docs with photo column
    if (showLinePhoto) {
      const productIds = (doc.lines ?? [])
        .map((l) => l.product_id)
        .filter((id): id is number => id != null);
      void Promise.all(
        productIds.map(async (id) => {
          const ref = await fetchProductImageRef(id);
          if (!ref) return;
          setLines((prev) =>
            prev.map((l) =>
              l.product_id === id && !l.imageDirty ? { ...l, image: ref } : l
            )
          );
        })
      );
    }
  };

  const loadDocumentForEdit = async (
    id: string,
    tiers: { clients: TierRecord[]; fournisseurs: TierRecord[] }
  ) => {
    setLoadingDoc(true);
    try {
      const doc = await documentService.getDocument(id);
      if (!doc) {
        toast.error('Document introuvable');
        onOpenChange(false);
        return;
      }
      populateFromDocument(doc);
      const meta = doc.metadata ?? {};
      if (doc.client_id) {
        const c = tiers.clients.find((cl) => cl.id === doc.client_id);
        if (c) applyTierSelection(c);
      } else if (doc.fournisseur_id) {
        const f = tiers.fournisseurs.find((fl) => fl.id === doc.fournisseur_id);
        if (f) applyTierSelection(f);
      } else {
        setPartyName(String(meta.third_party_name ?? doc.client_name ?? doc.fournisseur_name ?? ''));
        setPartyAddress(String(meta.third_party_address ?? ''));
        setPartyTaxId(String(meta.third_party_tax_id ?? ''));
        setPartyPhone(String(meta.third_party_phone ?? ''));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Chargement impossible');
      onOpenChange(false);
    } finally {
      setLoadingDoc(false);
    }
  };

  const loadTiers = async () => {
    const companyId = getActiveCompanyIdForQuery();
    let clientsQuery = supabase.from('clients').select('*');
    let fournisseursQuery = supabase.from('fournisseurs').select('*');
    if (companyId) {
      clientsQuery = filterByCompanyId(clientsQuery, companyId);
      fournisseursQuery = filterByCompanyId(fournisseursQuery, companyId);
    }
    const [cRes, fRes] = await Promise.all([
      clientsQuery.order('nom'),
      fournisseursQuery.order('nom'),
    ]);
    const nextClients = cRes.data ?? [];
    const nextFournisseurs = fRes.data ?? [];
    if (cRes.data) setClients(cRes.data);
    if (fRes.data) setFournisseurs(fRes.data);
    return { clients: nextClients, fournisseurs: nextFournisseurs };
  };

  const resetForm = () => {
    setNotes('');
    setValidity('30 jours');
    setTransportRef('');
    setDocumentDate(new Date().toISOString().split('T')[0]);
    setClientId(null);
    setFournisseurId(null);
    setPartyName('');
    setPartyAddress('');
    setPartyTaxId('');
    setPartyPhone('');
    setPartySuggestionsOpen(false);
    setBlPurpose(lockedBlPurpose ?? 'client');
    setServiceMotif('impression_logo');
    setSourceMagasin(currentCompany?.name ?? '');
    setDestinationMagasin('');
    setArticleMode('search');
    setManualDesignation('');
    setManualDescription('');
    setManualSku('');
    setManualQuantity(1);
    setManualUnitPrice(0);
    setLines([]);
  };

  useEffect(() => {
    if (open && lockedBlPurpose) {
      setBlPurpose(lockedBlPurpose);
      if (lockedBlPurpose === 'magasin_transfer' && !sourceMagasin.trim() && currentCompany?.name) {
        setSourceMagasin(currentCompany.name);
      }
    }
  }, [open, lockedBlPurpose, currentCompany?.name, sourceMagasin]);

  const addLine = (product: Product) => {
    if (lines.some((l) => l.product_id === product.id)) {
      toast.error("Ce produit est déjà dans la liste");
      return;
    }
    const lineKey = newLineKey();
    setLines((prev) => [
      ...prev,
      {
        lineKey,
        product_id: product.id,
        product_name: product.name,
        description: '',
        sku: product.sku || '',
        quantity: 1,
        unit_price: showLinePhoto ? 0 : (product.price || 0),
        image: product.image || null,
        imageDirty: false,
      },
    ]);
    if (showLinePhoto && !product.image) {
      void fetchProductImageRef(product.id).then((ref) => {
        if (!ref) return;
        setLines((prev) =>
          prev.map((l) =>
            l.lineKey === lineKey && !l.imageDirty ? { ...l, image: ref } : l
          )
        );
      });
    }
  };

  const commitManualLine = () => {
    const name = manualDesignation.trim();
    if (!name) {
      toast.error("Indiquez la désignation de l'article");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        lineKey: newLineKey(),
        product_id: null,
        product_name: name,
        description: manualDescription.trim(),
        sku: manualSku.trim(),
        quantity: Math.max(1, manualQuantity),
        unit_price: showLinePhoto ? 0 : manualUnitPrice,
        image: null,
        imageDirty: false,
      },
    ]);
    setManualDesignation('');
    setManualDescription('');
    setManualSku('');
    setManualQuantity(1);
    setManualUnitPrice(0);
  };

  const removeLine = (lineKey: string) => {
    setLines((prev) => prev.filter((l) => l.lineKey !== lineKey));
  };

  const updateLine = (lineKey: string, field: keyof DocumentLine, value: string | number | boolean | null) => {
    setLines((prev) =>
      prev.map((l) => (l.lineKey === lineKey ? { ...l, [field]: value } : l))
    );
  };

  const handleLineImageUpload = async (lineKey: string, file: File | undefined) => {
    if (!file) return;
    try {
      const { compressImage } = await import('@/lib/imageCompression');
      const compressed = await compressImage(file);
      setLines((prev) =>
        prev.map((l) =>
          l.lineKey === lineKey ? { ...l, image: compressed, imageDirty: true } : l
        )
      );
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : null;
        if (!result) return;
        setLines((prev) =>
          prev.map((l) =>
            l.lineKey === lineKey ? { ...l, image: result, imageDirty: true } : l
          )
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const clearLineImage = (lineKey: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.lineKey === lineKey ? { ...l, image: null, imageDirty: true } : l
      )
    );
  };

  const handleSubmit = async (generatePDF = false) => {
    if (lines.length === 0) {
      toast.error("Veuillez ajouter au moins un produit");
      return;
    }

    if (type === 'BL_CLIENT' && effectiveBlPurpose === 'client' && !partyName.trim()) {
      toast.error('Veuillez indiquer le client');
      return;
    }

    if (type === 'BL_CLIENT' && effectiveBlPurpose === 'magasin_transfer') {
      if (!sourceMagasin.trim() || !destinationMagasin.trim()) {
        toast.error('Indiquez le magasin d\'origine et le magasin de destination');
        return;
      }
      if (sourceMagasin.trim().toLowerCase() === destinationMagasin.trim().toLowerCase()) {
        toast.error('Les magasins d\'origine et de destination doivent être différents');
        return;
      }
    }

    if (type === 'BS' && !partyName.trim()) {
      toast.error('Veuillez indiquer le client');
      return;
    }

    if (type === 'BE' && !partyName.trim()) {
      toast.error('Veuillez indiquer le fournisseur');
      return;
    }

    if (type === 'BL_FOURNISSEUR' && !partyName.trim()) {
      toast.error('Veuillez indiquer le fournisseur (imprimeur / façonnier)');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        clientId: type === 'BL_CLIENT' && effectiveBlPurpose === 'magasin_transfer' ? undefined : (clientId || undefined),
        fournisseurId: isSupplierParty ? (fournisseurId || undefined) : (fournisseurId || undefined),
        notes,
        metadata: {
          ...(editDoc?.metadata ?? {}),
          origin: 'magasin',
          document_date: documentDate,
          validity,
          transport_ref: transportRef,
          third_party_name: type === 'BL_CLIENT' && effectiveBlPurpose === 'magasin_transfer'
            ? `Transfert: ${sourceMagasin.trim()} → ${destinationMagasin.trim()}`
            : partyName.trim(),
          third_party_address: partyAddress.trim(),
          third_party_tax_id: partyTaxId.trim(),
          third_party_phone: partyPhone.trim(),
          ...(type === 'BL_CLIENT'
            ? {
                bl_purpose: effectiveBlPurpose,
                ...(effectiveBlPurpose === 'magasin_transfer'
                  ? {
                      source_magasin: sourceMagasin.trim(),
                      destination_magasin: destinationMagasin.trim(),
                    }
                  : {}),
              }
            : {}),
          ...(type === 'BL_FOURNISSEUR'
            ? {
                bl_purpose: 'envoi_faconnage',
                service_motif: serviceMotif,
                service_motif_label: SERVICE_MOTIF_LABELS[serviceMotif],
              }
            : {}),
          ...(initialData && !isEditMode
            ? {
                source: 'stock_transaction',
                ...(initialData.transactionId ? { transaction_id: initialData.transactionId } : {}),
                linked_quantity: initialData.quantity,
                linked_product_id: initialData.productId,
              }
            : {}),
        },
        lines: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: showLinePhoto ? 0 : l.unit_price,
          description:
            l.product_id == null
              ? encodeManualLineDescription(l.product_name, l.description)
              : (l.description.trim() || undefined),
        })),
      };

      const result = isEditMode && editDocumentId
        ? await documentService.updateDocument(editDocumentId, {
            clientId: type === 'BL_CLIENT' && effectiveBlPurpose === 'magasin_transfer' ? null : (clientId ?? null),
            fournisseurId: isSupplierParty ? (fournisseurId ?? null) : (fournisseurId ?? null),
            notes: payload.notes,
            metadata: payload.metadata,
            lines: payload.lines,
          })
        : await documentService.createDocument({
            type,
            status: 'PENDING',
            ...payload,
          });

      if (result.success) {
        // Persist uploaded photos onto the catalog product (stock table Image column)
        if (showLinePhoto) {
          const photoUpdates = lines.filter(
            (l) => l.product_id != null && l.imageDirty
          );
          for (const line of photoUpdates) {
            await updateProduct(line.product_id!, { image: line.image });
            invalidateProductImageRef(line.product_id!);
          }
          const skippedManual = lines.some((l) => l.product_id == null && l.imageDirty && l.image);
          if (skippedManual) {
            toast.message(
              'Photo ignorée pour les articles en saisie libre — liez un produit catalogue pour l’afficher en stock.'
            );
          }
        }
        toast.success(isEditMode ? 'Document mis à jour' : 'Document créé avec succès');
        if (mandatory || initialData) {
          clearPendingWarehouseDocument();
        }
        if (generatePDF && result.document) {
          const docForPDF = {
            ...result.document,
            notes: notes.trim() || result.document.notes || null,
            metadata: payload.metadata,
            lines: lines.map((l) => ({
              product_id: l.product_id,
              quantity: l.quantity,
              unit_price: showLinePhoto ? 0 : l.unit_price,
              total_price: showLinePhoto ? 0 : l.quantity * l.unit_price,
              description: l.description.trim() || null,
              products: { name: l.product_name, sku: l.sku },
            })),
            client_name: type === 'BL_CLIENT' || type === 'BS' ? partyName.trim() : null,
            fournisseur_name: isSupplierParty ? partyName.trim() : null,
          };
          await downloadUnifiedDocumentPDF(docForPDF as UnifiedDocument);
        }
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error('Erreur : ' + result.error);
      }
    } catch (error: unknown) {
      toast.error(
        (isEditMode ? 'Erreur lors de la mise à jour : ' : 'Erreur lors de la création : ') +
          (error instanceof Error ? error.message : 'Erreur inconnue')
      );
    } finally {
      setLoading(false);
    }
  };

  const titleMap: Record<UnifiedDocumentType, string> = {
    'BE': "Bon d'Entrée Stock",
    'BS': "Bon de Sortie Stock",
    'BL_CLIENT': "Bon de Livraison Client",
    'DEMANDE_ACHAT': "Demande d'Achat",
    'BC_CLIENT': "Bon de Commande Client",
    'DEVIS_FOURNISSEUR': "Devis Fournisseur",
    'BC_FOURNISSEUR': "Bon de Commande Fournisseur",
    'BL_FOURNISSEUR': "BL Fournisseur — Envoi façonnage",
    'FACTURE': "Facture"
  };

  const partyLabel = isSupplierParty ? 'Fournisseur' : 'Client';

  const handleDialogOpenChange = (nextOpen: boolean) => {
    const companyId = getActiveCompanyIdForQuery();
    if (!nextOpen && mandatory && readPendingWarehouseDocument(companyId)) {
      toast.error(
        type === 'BE'
          ? "Le bon d'entrée est obligatoire pour finaliser cette transaction."
          : 'Le bon de sortie est obligatoire pour finaliser cette transaction.'
      );
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className={cn(
          'left-1/2 top-0 h-[100dvh] w-[min(100vw,72rem)] max-h-none max-w-6xl -translate-x-1/2 translate-y-0 rounded-none sm:rounded-none',
          'flex flex-col gap-0 overflow-hidden p-0 border-x shadow-2xl',
          // Larger, clearer close control (overrides default DialogContent X)
          '[&>button]:right-5 [&>button]:top-4 [&>button]:flex [&>button]:h-12 [&>button]:w-12 [&>button]:items-center [&>button]:justify-center',
          '[&>button]:rounded-lg [&>button]:border [&>button]:border-border [&>button]:bg-muted/80 [&>button]:opacity-100 [&>button]:shadow-sm',
          '[&>button]:hover:bg-muted [&>button]:hover:opacity-100 [&>button]:hover:text-foreground',
          '[&>button>svg]:h-7 [&>button>svg]:w-7',
          mandatory && '[&>button]:hidden'
        )}
        onInteractOutside={(e) => mandatory && e.preventDefault()}
        onEscapeKeyDown={(e) => mandatory && e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-20 text-left">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            {isEditMode
              ? `Modifier ${titleMap[type] ?? 'document'}${editDoc?.numero ? ` — ${editDoc.numero}` : ''}`
              : titleMap[type] || 'Nouveau Document'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditMode
              ? `Formulaire de modification de ${titleMap[type] || 'document magasin'}.`
              : `Formulaire de création de ${titleMap[type] || 'document magasin'}.`}
          </DialogDescription>
          {mandatory && (
            <p className="text-sm text-amber-600 dark:text-amber-400 pt-2">
              Ce document est obligatoire suite à la transaction stock enregistrée.
            </p>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <div className="space-y-8 py-4">
          {loadingDoc ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Chargement du document…
            </div>
          ) : (
          <>
          {/* Section 1: Informations Générales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/20 p-6 rounded-xl border">
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Validité</Label>
              <Input 
                placeholder="Ex: 30 jours" 
                value={validity}
                onChange={(e) => setValidity(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Immatriculation voiture (transporteur)
              </Label>
              <Input 
                placeholder="Saisie libre — ex: 123 TUN 4567" 
                value={transportRef}
                onChange={(e) => setTransportRef(e.target.value)}
                className="bg-background"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Date Document</Label>
              <Input 
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>

          {/* Section 2: Tiers (Client/Fournisseur) ou transfert magasin */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
              {type === 'BE'
                ? 'Informations Fournisseur'
                : type === 'BL_FOURNISSEUR'
                  ? 'Fournisseur (imprimeur / façonnier)'
                  : type === 'BL_CLIENT'
                    ? 'Destination du bon de livraison'
                    : 'Informations Client'}
            </h3>

            {type === 'BL_FOURNISSEUR' && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <Label className="text-sm font-semibold">Motif de l&apos;envoi</Label>
                <RadioGroup
                  value={serviceMotif}
                  onValueChange={(v) => setServiceMotif(v as ServiceMotif)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {SERVICE_MOTIF_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      htmlFor={`blf-motif-${opt.value}`}
                      className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <RadioGroupItem
                        value={opt.value}
                        id={`blf-motif-${opt.value}`}
                        className="mt-0.5"
                      />
                      <span className="font-medium text-sm">{opt.label}</span>
                    </label>
                  ))}
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Ex. : envoi d&apos;articles pour impression logo, marquage de noms, broderie…
                  Précisez le détail dans les notes ou la description des lignes.
                </p>
              </div>
            )}

            {type === 'BL_CLIENT' && !lockedBlPurpose && (
              <RadioGroup
                value={blPurpose}
                onValueChange={(v) => {
                  const next = v as BlPurpose;
                  setBlPurpose(next);
                  if (next === 'magasin_transfer') {
                    setClientId(null);
                    setPartyName('');
                    setPartyAddress('');
                    setPartyTaxId('');
                    setPartyPhone('');
                    setPartySuggestionsOpen(false);
                    if (!sourceMagasin.trim() && currentCompany?.name) {
                      setSourceMagasin(currentCompany.name);
                    }
                  } else {
                    setDestinationMagasin('');
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <label
                  htmlFor="bl-purpose-client"
                  className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem value="client" id="bl-purpose-client" className="mt-0.5" />
                  <div>
                    <p className="font-medium">Livraison client</p>
                    <p className="text-xs text-muted-foreground">Sortie stock vers un client</p>
                  </div>
                </label>
                <label
                  htmlFor="bl-purpose-transfer"
                  className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem value="magasin_transfer" id="bl-purpose-transfer" className="mt-0.5" />
                  <div>
                    <p className="font-medium">Transfert inter-magasins</p>
                    <p className="text-xs text-muted-foreground">Même société, pas de client</p>
                  </div>
                </label>
              </RadioGroup>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {type === 'BL_CLIENT' && effectiveBlPurpose === 'magasin_transfer' ? (
                  <>
                    <div className="space-y-2">
                      <Label>Magasin d&apos;origine</Label>
                      <Input
                        list="magasin-options"
                        value={sourceMagasin}
                        onChange={(e) => setSourceMagasin(e.target.value)}
                        placeholder="Ex: Dépôt central"
                      />
                      <datalist id="magasin-options">
                        {companies.map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label>Magasin de destination</Label>
                      <Input
                        value={destinationMagasin}
                        onChange={(e) => setDestinationMagasin(e.target.value)}
                        placeholder="Saisie libre — ex: Magasin Sfax"
                        autoComplete="off"
                      />
                      <p className="text-xs text-muted-foreground">
                        Saisie libre (pas de liste déroulante).
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Transfert interne : aucun client n&apos;est associé à ce BL.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>{partyLabel} (catalogue ou saisie libre)</Label>
                      <div className="relative">
                        <Input
                          ref={partyInputRef}
                          placeholder={`Nom du ${partyLabel.toLowerCase()}…`}
                          value={partyName}
                          onChange={(e) => handlePartyNameChange(e.target.value)}
                          onFocus={() => {
                            if (partyName.trim()) setPartySuggestionsOpen(true);
                          }}
                          onBlur={() => {
                            // Delay so suggestion onMouseDown can fire first.
                            window.setTimeout(() => setPartySuggestionsOpen(false), 150);
                          }}
                          autoComplete="off"
                          className="bg-background"
                        />
                        <DevisAnchoredDropdown
                          anchorRef={partyInputRef}
                          open={
                            partySuggestionsOpen &&
                            tierSuggestions.length > 0 &&
                            !!partyName.trim()
                          }
                          className="max-h-44"
                        >
                          {tierSuggestions.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                applyTierSelection(item);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted border-b border-border last:border-b-0"
                            >
                              <span className="font-medium">{item.nom || item.raison_sociale}</span>
                              {(item.matricule_fiscal || item.tax_id) && (
                                <span className="block text-xs text-muted-foreground font-mono mt-0.5">
                                  {item.matricule_fiscal || item.tax_id}
                                </span>
                              )}
                            </button>
                          ))}
                        </DevisAnchoredDropdown>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sélectionnez dans la liste ou saisissez librement un {partyLabel.toLowerCase()} absent du catalogue.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Adresse</Label>
                        <Input
                          value={partyAddress}
                          onChange={(e) => setPartyAddress(e.target.value)}
                          placeholder="Adresse…"
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>MF / Tax ID</Label>
                        <Input
                          value={partyTaxId}
                          onChange={(e) => setPartyTaxId(e.target.value)}
                          placeholder="Matricule fiscal…"
                          className="bg-background"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Téléphone</Label>
                      <Input
                        value={partyPhone}
                        onChange={(e) => setPartyPhone(e.target.value)}
                        placeholder="Téléphone…"
                        className="bg-background"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes / Observations</Label>
                <textarea 
                  className="w-full min-h-[120px] p-3 rounded-md border bg-background text-sm resize-none focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Ajouter des notes internes ou externes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Articles */}
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                Articles & Produits
              </h3>
              <DevisSegmentedGrid cols={2}>
                <DevisSegmentedOption
                  value="search"
                  current={articleMode}
                  accent="vente"
                  onSelect={setArticleMode}
                  label="Catalogue"
                  icon={Search}
                  className="min-h-[2.25rem] py-2"
                />
                <DevisSegmentedOption
                  value="manual"
                  current={articleMode}
                  accent="vente"
                  onSelect={setArticleMode}
                  label="Saisie libre"
                  icon={Edit}
                  className="min-h-[2.25rem] py-2"
                />
              </DevisSegmentedGrid>
            </div>
            
            <div className="bg-muted/30 p-6 rounded-xl border border-dashed border-primary/20 space-y-4">
              <Label className="block text-primary/70 font-medium">
                {articleMode === 'search'
                  ? 'Ajouter un article du catalogue'
                  : 'Ajouter un article en saisie libre'}
              </Label>
              {articleMode === 'search' ? (
                <CategoryProductSelector 
                  selectedProductId={null}
                  onSelect={(product) => addLine(product)}
                />
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-5 space-y-1">
                      <Label className="text-xs text-muted-foreground">Désignation</Label>
                      <Input
                        value={manualDesignation}
                        onChange={(e) => setManualDesignation(e.target.value)}
                        placeholder="Saisie libre — nom de l'article…"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commitManualLine())}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Réf.</Label>
                      <Input
                        value={manualSku}
                        onChange={(e) => setManualSku(e.target.value)}
                        placeholder="SKU (opt.)"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Qté</Label>
                      <Input
                        type="number"
                        min={1}
                        value={manualQuantity}
                        onChange={(e) => setManualQuantity(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                    {!showLinePhoto && (
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">Prix HT</Label>
                        <DecimalInput
                          value={manualUnitPrice}
                          onValueChange={setManualUnitPrice}
                        />
                      </div>
                    )}
                    <div className={showLinePhoto ? 'md:col-span-3' : 'md:col-span-1'}>
                      <Button type="button" onClick={commitManualLine} className="w-full gap-1">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Description (tailles, couleurs, détails…)</Label>
                    <textarea
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      placeholder="Ex: Taille L, couleur bleue, lot 2026…"
                      rows={2}
                      className="w-full p-2 rounded-md border bg-background text-sm resize-y min-h-[2.5rem] focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {lines.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border-2 border-dashed flex flex-col items-center gap-2">
                  <Plus className="w-8 h-8 opacity-20" />
                  <p>Aucun article ajouté à ce document</p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="p-4 text-left font-bold text-muted-foreground uppercase tracking-wider text-xs">Produit / Description</th>
                        <th className="p-4 text-center font-bold text-muted-foreground uppercase tracking-wider text-xs w-32">Quantité</th>
                        {showLinePhoto ? (
                          <th className="p-4 text-center font-bold text-muted-foreground uppercase tracking-wider text-xs w-40">Photo</th>
                        ) : (
                          <>
                            <th className="p-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs w-32">Prix Unitaire</th>
                            <th className="p-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs w-32">Total HT</th>
                          </>
                        )}
                        <th className="p-4 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-card">
                      {lines.map((line) => (
                        <tr key={line.lineKey} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <div className="flex gap-3 items-start">
                              {showLinePhoto && (
                                <div className="shrink-0">
                                  {line.image || line.product_id != null ? (
                                    <LazyProductImage
                                      productId={line.product_id ?? undefined}
                                      storedRef={
                                        line.imageDirty || line.image != null
                                          ? line.image
                                          : undefined
                                      }
                                      alt={line.product_name}
                                      className="w-12 h-12 rounded-lg"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg bg-muted/40 flex items-center justify-center">
                                      <ImagePlus className="w-5 h-5 text-muted-foreground/40" />
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                {line.product_id == null ? (
                                  <div className="space-y-1.5">
                                    <Input
                                      value={line.product_name}
                                      onChange={(e) => updateLine(line.lineKey, 'product_name', e.target.value)}
                                      className="font-semibold"
                                      placeholder="Nom de l'article"
                                    />
                                    <textarea
                                      value={line.description}
                                      onChange={(e) => updateLine(line.lineKey, 'description', e.target.value)}
                                      placeholder="Description — tailles, couleurs, détails…"
                                      rows={2}
                                      className="w-full p-2 rounded-md border bg-background text-xs resize-y min-h-[2.25rem] focus:ring-2 focus:ring-primary focus:outline-none"
                                    />
                                    <Input
                                      value={line.sku}
                                      onChange={(e) => updateLine(line.lineKey, 'sku', e.target.value)}
                                      placeholder="Réf. (optionnel)"
                                      className="text-xs font-mono h-8"
                                    />
                                    <span className="text-[10px] text-muted-foreground">Saisie libre</span>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    <div className="font-semibold text-base">{line.product_name}</div>
                                    <div className="text-xs font-mono text-primary/70">{line.sku}</div>
                                    <textarea
                                      value={line.description}
                                      onChange={(e) => updateLine(line.lineKey, 'description', e.target.value)}
                                      placeholder="Description — tailles, couleurs, détails…"
                                      rows={2}
                                      className="w-full p-2 rounded-md border bg-background text-xs resize-y min-h-[2.25rem] focus:ring-2 focus:ring-primary focus:outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <Input 
                              type="number" 
                              min="1" 
                              className="h-10 text-center font-bold"
                              value={line.quantity}
                              onChange={(e) => updateLine(line.lineKey, 'quantity', Number(e.target.value))}
                            />
                          </td>
                          {showLinePhoto ? (
                            <td className="p-4">
                              <div className="flex flex-col items-center gap-2">
                                <label className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-dashed border-primary/40 bg-primary/5 text-xs font-medium text-primary cursor-pointer hover:bg-primary/10 transition-colors">
                                  <ImagePlus className="w-3.5 h-3.5" />
                                  {line.image ? 'Changer' : 'Importer'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      void handleLineImageUpload(line.lineKey, e.target.files?.[0]);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                {line.image && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                    onClick={() => clearLineImage(line.lineKey)}
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    Retirer
                                  </Button>
                                )}
                                {line.product_id == null && (
                                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                                    Visible en stock si produit catalogue
                                  </span>
                                )}
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="p-4 text-right">
                                <DecimalInput
                                  className="h-10 text-right font-medium"
                                  value={line.unit_price ?? 0}
                                  onValueChange={(v) => updateLine(line.lineKey, 'unit_price', v)}
                                />
                              </td>
                              <td className="p-4 text-right font-bold text-base text-primary">
                                {(line.quantity * line.unit_price).toFixed(3)}
                              </td>
                            </>
                          )}
                          <td className="p-4">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                              onClick={() => removeLine(line.lineKey)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {!showLinePhoto && (
                      <tfoot className="bg-muted/20 border-t">
                        <tr>
                          <td colSpan={3} className="p-6 text-right font-black uppercase tracking-widest text-xs text-muted-foreground">Total Global (TND)</td>
                          <td className="p-6 text-right font-black text-2xl text-primary">
                            {lines.reduce((acc, l) => acc + (l.quantity * l.unit_price), 0).toFixed(3)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </div>
          </>
          )}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-3 border-t bg-background px-6 py-4 sm:space-x-0">
          {!mandatory && (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || loadingDoc} className="h-12 px-6">
              Annuler
            </Button>
          )}
          <Button 
            variant="secondary"
            onClick={() => handleSubmit(false)} 
            disabled={loading || loadingDoc} 
            className="h-12 px-6 gap-2"
          >
            <Save className="w-4 h-4" />
            {isEditMode ? 'Enregistrer' : 'Enregistrer seulement'}
          </Button>
          <Button 
            onClick={() => handleSubmit(true)} 
            disabled={loading || loadingDoc} 
            className="h-12 px-6 gap-2 bg-primary hover:bg-primary/90"
          >
            <Download className="w-4 h-4" />
            {isEditMode ? 'Enregistrer & PDF' : 'Enregistrer & Générer PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
