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
  Plus, Trash2, FileText, Download, Save, Loader2, Search, Edit 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Product, UnifiedDocument, UnifiedDocumentType } from '@/types';
import { documentService } from '@/modules/commercial';
import { toast } from 'sonner';
import { CategoryProductSelector } from '../shared/CategoryProductSelector';
import { downloadUnifiedDocumentPDF } from '@/utils/pdfGenerator';
import { PendingWarehouseDocument, clearPendingWarehouseDocument, readPendingWarehouseDocument } from '@/lib/appNavigationStorage';
import { getActiveCompanyIdForQuery } from '@/lib/activeCompany';
import { useAppCompany } from '@/contexts/AppCompanyContext';
import { DevisAnchoredDropdown } from '../devis/DevisAnchoredDropdown';
import { DevisSegmentedGrid, DevisSegmentedOption } from '../devis/DevisFormUi';

type BlPurpose = 'client' | 'magasin_transfer';
type ArticleMode = 'search' | 'manual';

type DocumentLine = {
  lineKey: string;
  product_id: number | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
};

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
}

export const DocumentCreationDialog = ({
  open,
  onOpenChange,
  type,
  onSuccess,
  initialData = null,
  mandatory = false,
  editDocumentId = null,
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
  const [blPurpose, setBlPurpose] = useState<BlPurpose>('client');
  const [sourceMagasin, setSourceMagasin] = useState('');
  const [destinationMagasin, setDestinationMagasin] = useState('');
  const [articleMode, setArticleMode] = useState<ArticleMode>('search');
  const [manualDesignation, setManualDesignation] = useState('');
  const [manualSku, setManualSku] = useState('');
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualUnitPrice, setManualUnitPrice] = useState(0);
  
  const [clients, setClients] = useState<TierRecord[]>([]);
  const [fournisseurs, setFournisseurs] = useState<TierRecord[]>([]);
  const [lines, setLines] = useState<DocumentLine[]>([]);

  const tierList = type === 'BE' ? fournisseurs : clients;

  const tierSuggestions = useMemo(() => {
    const q = partyName.trim().toLowerCase();
    if (!q) return [];
    return tierList
      .filter((t) => (t.nom || t.raison_sociale || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [partyName, tierList]);

  const applyTierSelection = (tier: TierRecord) => {
    setPartyName(tier.nom || tier.raison_sociale || '');
    setPartyAddress(tier.adresse || tier.location || '');
    setPartyTaxId(tier.matricule_fiscal || tier.tax_id || '');
    setPartyPhone(tier.telephone || tier.phone || '');
    if (type === 'BE') {
      setFournisseurId(tier.id);
      setClientId(null);
    } else {
      setClientId(tier.id);
      setFournisseurId(null);
    }
  };

  const handlePartyNameChange = (value: string) => {
    setPartyName(value);
    if (type === 'BE') {
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
        setArticleMode('search');
        setLines([{
          lineKey: newLineKey(),
          product_id: initialData.productId,
          product_name: initialData.productName,
          sku: initialData.sku,
          quantity: initialData.quantity,
          unit_price: initialData.unitPrice,
        }]);
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
    setSourceMagasin(String(meta.source_magasin ?? currentCompany?.name ?? ''));
    setDestinationMagasin(String(meta.destination_magasin ?? ''));
    setArticleMode('search');
    setLines(
      (doc.lines ?? []).map((line) => ({
        lineKey: String(line.id ?? newLineKey()),
        product_id: line.product_id,
        product_name:
          line.product_id != null
            ? (line.product_name ?? line.description ?? 'Article')
            : (line.description ?? line.product_name ?? 'Article'),
        sku: line.product_sku ?? '',
        quantity: line.quantity,
        unit_price: line.unit_price,
      }))
    );
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
    const [cRes, fRes] = await Promise.all([
      supabase.from('clients').select('*').order('nom'),
      supabase.from('fournisseurs').select('*').order('nom'),
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
    setBlPurpose('client');
    setSourceMagasin(currentCompany?.name ?? '');
    setDestinationMagasin('');
    setArticleMode('search');
    setManualDesignation('');
    setManualSku('');
    setManualQuantity(1);
    setManualUnitPrice(0);
    setLines([]);
  };

  useEffect(() => {
    if (open && type === 'BL_CLIENT' && !sourceMagasin && currentCompany?.name) {
      setSourceMagasin(currentCompany.name);
    }
  }, [open, type, currentCompany?.name, sourceMagasin]);

  const addLine = (product: Product) => {
    if (lines.some((l) => l.product_id === product.id)) {
      toast.error("Ce produit est déjà dans la liste");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        lineKey: newLineKey(),
        product_id: product.id,
        product_name: product.name,
        sku: product.sku || '',
        quantity: 1,
        unit_price: product.price || 0,
      },
    ]);
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
        sku: manualSku.trim(),
        quantity: Math.max(1, manualQuantity),
        unit_price: manualUnitPrice,
      },
    ]);
    setManualDesignation('');
    setManualSku('');
    setManualQuantity(1);
    setManualUnitPrice(0);
  };

  const removeLine = (lineKey: string) => {
    setLines((prev) => prev.filter((l) => l.lineKey !== lineKey));
  };

  const updateLine = (lineKey: string, field: keyof DocumentLine, value: string | number) => {
    setLines((prev) =>
      prev.map((l) => (l.lineKey === lineKey ? { ...l, [field]: value } : l))
    );
  };

  const handleSubmit = async (generatePDF = false) => {
    if (lines.length === 0) {
      toast.error("Veuillez ajouter au moins un produit");
      return;
    }

    if (type === 'BL_CLIENT' && blPurpose === 'client' && !partyName.trim()) {
      toast.error('Veuillez indiquer le client');
      return;
    }

    if (type === 'BL_CLIENT' && blPurpose === 'magasin_transfer') {
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

    setLoading(true);
    try {
      const payload = {
        clientId: type === 'BL_CLIENT' && blPurpose === 'magasin_transfer' ? undefined : (clientId || undefined),
        fournisseurId: fournisseurId || undefined,
        notes,
        metadata: {
          ...(editDoc?.metadata ?? {}),
          origin: 'magasin',
          document_date: documentDate,
          validity,
          transport_ref: transportRef,
          third_party_name: type === 'BL_CLIENT' && blPurpose === 'magasin_transfer'
            ? `Transfert: ${sourceMagasin.trim()} → ${destinationMagasin.trim()}`
            : partyName.trim(),
          third_party_address: partyAddress.trim(),
          third_party_tax_id: partyTaxId.trim(),
          third_party_phone: partyPhone.trim(),
          ...(type === 'BL_CLIENT'
            ? {
                bl_purpose: blPurpose,
                ...(blPurpose === 'magasin_transfer'
                  ? {
                      source_magasin: sourceMagasin.trim(),
                      destination_magasin: destinationMagasin.trim(),
                    }
                  : {}),
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
          unit_price: l.unit_price,
          description: l.product_id == null ? l.product_name.trim() : undefined,
        })),
      };

      const result = isEditMode && editDocumentId
        ? await documentService.updateDocument(editDocumentId, {
            clientId: type === 'BL_CLIENT' && blPurpose === 'magasin_transfer' ? null : (clientId ?? null),
            fournisseurId: fournisseurId ?? null,
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
        toast.success(isEditMode ? 'Document mis à jour' : 'Document créé avec succès');
        if (mandatory || initialData) {
          clearPendingWarehouseDocument();
        }
        if (generatePDF && result.document) {
          const docForPDF = {
            ...result.document,
            metadata: payload.metadata,
            lines: lines.map((l) => ({
              product_id: l.product_id,
              quantity: l.quantity,
              unit_price: l.unit_price,
              total_price: l.quantity * l.unit_price,
              description: l.product_id == null ? l.product_name : null,
              products: l.product_id != null ? { name: l.product_name, sku: l.sku } : undefined,
            })),
            client_name: type === 'BL_CLIENT' || type === 'BS' ? partyName.trim() : null,
            fournisseur_name: type === 'BE' ? partyName.trim() : null,
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
    'BL_FOURNISSEUR': "Bon de Livraison Fournisseur",
    'FACTURE': "Facture"
  };

  const partyLabel = type === 'BE' ? 'Fournisseur' : 'Client';

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
        className={`max-w-5xl max-h-[95vh] overflow-y-auto${mandatory ? ' [&>button]:hidden' : ''}`}
        onInteractOutside={(e) => mandatory && e.preventDefault()}
        onEscapeKeyDown={(e) => mandatory && e.preventDefault()}
      >
        <DialogHeader>
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
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Réf. Transport</Label>
              <Input 
                placeholder="Ex: TUN-1234" 
                value={transportRef}
                onChange={(e) => setTransportRef(e.target.value)}
                className="bg-background"
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
                : type === 'BL_CLIENT'
                  ? 'Destination du bon de livraison'
                  : 'Informations Client'}
            </h3>

            {type === 'BL_CLIENT' && (
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
                {type === 'BL_CLIENT' && blPurpose === 'magasin_transfer' ? (
                  <>
                    <div className="space-y-2">
                      <Label>Magasin d&apos;origine</Label>
                      <Input
                        list="magasin-options"
                        value={sourceMagasin}
                        onChange={(e) => setSourceMagasin(e.target.value)}
                        placeholder="Ex: Dépôt central"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Magasin de destination</Label>
                      <Input
                        list="magasin-options"
                        value={destinationMagasin}
                        onChange={(e) => setDestinationMagasin(e.target.value)}
                        placeholder="Ex: Magasin Sfax"
                      />
                    </div>
                    <datalist id="magasin-options">
                      {companies.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
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
                          autoComplete="off"
                          className="bg-background"
                        />
                        <DevisAnchoredDropdown
                          anchorRef={partyInputRef}
                          open={tierSuggestions.length > 0 && !!partyName.trim()}
                          className="max-h-44"
                        >
                          {tierSuggestions.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onMouseDown={() => applyTierSelection(item)}
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
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5 space-y-1">
                    <Label className="text-xs text-muted-foreground">Désignation</Label>
                    <Input
                      value={manualDesignation}
                      onChange={(e) => setManualDesignation(e.target.value)}
                      placeholder="Saisie libre — article…"
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
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs text-muted-foreground">Prix HT</Label>
                    <DecimalInput
                      value={manualUnitPrice}
                      onValueChange={setManualUnitPrice}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Button type="button" onClick={commitManualLine} className="w-full gap-1">
                      <Plus className="w-4 h-4" />
                    </Button>
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
                        <th className="p-4 text-left font-bold text-muted-foreground uppercase tracking-wider text-xs">Produit</th>
                        <th className="p-4 text-center font-bold text-muted-foreground uppercase tracking-wider text-xs w-32">Quantité</th>
                        <th className="p-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs w-32">Prix Unitaire</th>
                        <th className="p-4 text-right font-bold text-muted-foreground uppercase tracking-wider text-xs w-32">Total HT</th>
                        <th className="p-4 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-card">
                      {lines.map((line) => (
                        <tr key={line.lineKey} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            {line.product_id == null ? (
                              <div className="space-y-1">
                                <Input
                                  value={line.product_name}
                                  onChange={(e) => updateLine(line.lineKey, 'product_name', e.target.value)}
                                  className="font-semibold"
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
                              <>
                                <div className="font-semibold text-base">{line.product_name}</div>
                                <div className="text-xs font-mono text-primary/70">{line.sku}</div>
                              </>
                            )}
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
                    <tfoot className="bg-muted/20 border-t">
                      <tr>
                        <td colSpan={3} className="p-6 text-right font-black uppercase tracking-widest text-xs text-muted-foreground">Total Global (TND)</td>
                        <td className="p-6 text-right font-black text-2xl text-primary">
                          {lines.reduce((acc, l) => acc + (l.quantity * l.unit_price), 0).toFixed(3)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
          </>
          )}
        </div>

        <DialogFooter className="gap-3 mt-4 border-t pt-6">
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
