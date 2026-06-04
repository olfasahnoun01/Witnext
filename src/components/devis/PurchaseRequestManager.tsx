import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardPlus, Search, Send, ShoppingCart, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { documentService } from '@/services/documentService';
import { CommercialAttachmentField } from '@/components/shared/CommercialAttachmentField';
import { CommercialAttachmentBadges } from '@/components/shared/CommercialAttachmentBadges';
import { uploadCommercialAttachments } from '@/lib/commercialAttachments';
import { UnifiedDocument } from '@/types';
import { ProcurementDialog } from './ProcurementDialog';

interface ProductOption {
  id: number;
  name: string;
  sku: string;
  quantity: number;
}

interface SupplierOption {
  id: number;
  nom: string;
}

interface PurchaseRequestLine {
  mode: 'inventory' | 'free';
  product_id: number;
  custom_name: string;
  supplier_mode: 'select' | 'free';
  fournisseur_id: number;
  fournisseur_name: string;
  quantity: number;
  description: string;
}

const emptyLine = (): PurchaseRequestLine => ({
  mode: 'inventory',
  product_id: 0,
  custom_name: '',
  supplier_mode: 'select',
  fournisseur_id: 0,
  fournisseur_name: '',
  quantity: 1,
  description: '',
});

const getPreferredSupplier = (description?: string | null) => {
  if (!description) return '';
  const match = description.match(/Fournisseur:\s*([^|]+)/i);
  return match?.[1]?.trim() || '';
};

const getExtraDescription = (description?: string | null) => {
  if (!description) return '';
  return description
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith('Fournisseur:'))
    .slice(1)
    .join(' | ');
};

const normalizePosteKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

export const PurchaseRequestManager = () => {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<UnifiedDocument[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [fournisseurs, setFournisseurs] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [targetRole, setTargetRole] = useState<'responsable_stock' | 'responsable_achat'>('responsable_stock');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PurchaseRequestLine[]>([emptyLine()]);
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [procurementRequest, setProcurementRequest] = useState<UnifiedDocument | null>(null);

  const currentUserPosition = String(
    user?.user_metadata?.position || user?.user_metadata?.role || ''
  ).trim();
  const currentUserPositionKey = normalizePosteKey(currentUserPosition);
  const isResponsableCommercial =
    currentUserPositionKey === 'responsable commerciale' || currentUserPositionKey === 'responsable commercial';
  const isResponsableStock =
    currentUserPositionKey === 'responsable magazin' ||
    currentUserPositionKey === 'responsable magasin' ||
    currentUserPositionKey === 'responsable stock';
  const isResponsableAchat = currentUserPositionKey === 'responsable achat';
  const purchaseRequestTargets: Array<'responsable_stock' | 'responsable_achat'> =
    isResponsableCommercial || isAdmin ? ['responsable_stock', 'responsable_achat'] : [];
  const canCreatePurchaseRequest = isResponsableCommercial || isAdmin;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: docs, error: docsError },
        { data: productData, error: productsError },
        { data: fournisseursData, error: fournisseursError },
      ] = await Promise.all([
        supabase
          .from('documents')
          .select(`
            *,
            document_lines(*, products(name, sku, quantity))
          `)
          .eq('type', 'DEMANDE_ACHAT')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('products')
          .select('id, name, sku, quantity')
          .order('name'),
        supabase
          .from('fournisseurs')
          .select('id, nom')
          .order('created_at', { ascending: false }),
      ]);

      if (docsError) throw docsError;
      if (productsError) throw productsError;
      if (fournisseursError) throw fournisseursError;

      const mappedRequests = (docs || []).map((doc) => ({
        ...doc,
        lines: (doc.document_lines || []).map((line: any) => ({
          ...line,
          product_name: line.products?.name,
          product_sku: line.products?.sku,
          available_quantity: line.products?.quantity ?? 0,
        })),
      })) as UnifiedDocument[];

      setRequests(mappedRequests);
      setProducts((productData || []) as ProductOption[]);
      setFournisseurs((fournisseursData || []) as SupplierOption[]);
    } catch (error: any) {
      console.error('Error loading purchase requests:', error);
      toast.error('Erreur lors du chargement des demandes d\'achat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const loadRequesterName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const resolvedName = data?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      setRequesterName(resolvedName);
    };

    loadRequesterName();
  }, [user]);

  useEffect(() => {
    if (purchaseRequestTargets.length > 0 && !purchaseRequestTargets.includes(targetRole)) {
      setTargetRole(purchaseRequestTargets[0]);
    }
  }, [purchaseRequestTargets, targetRole]);

  const resetForm = useCallback(() => {
    setRequesterName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || '');
    setTargetRole(purchaseRequestTargets[0] ?? 'responsable_stock');
    setNotes('');
    setLines([emptyLine()]);
    setPendingAttachmentFiles([]);
  }, [user, purchaseRequestTargets]);

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const updateLine = (index: number, patch: Partial<PurchaseRequestLine>) => {
    setLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));
  };

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return requests;

    return requests.filter((request) => {
      const requester = String((request.metadata as Record<string, unknown>)?.requester_name || '').toLowerCase();
      const stockReview = String((request.metadata as Record<string, unknown>)?.stock_review || '').toLowerCase();
      return (
        request.numero.toLowerCase().includes(term) ||
        requester.includes(term) ||
        stockReview.includes(term)
      );
    });
  }, [requests, searchTerm]);

  const handleCreateRequest = async () => {
    if (!canCreatePurchaseRequest) {
      toast.error('Seuls le responsable commercial et l\'administrateur peuvent créer une demande d\'achat.');
      return;
    }

    const validLines = lines.filter((line) =>
      line.quantity > 0 &&
      (line.mode === 'inventory' ? line.product_id > 0 : line.custom_name.trim().length > 0) &&
      line.fournisseur_name.trim().length > 0
    );
    const hasContent =
      validLines.length > 0 || pendingAttachmentFiles.length > 0 || notes.trim().length > 0;
    if (!hasContent) {
      toast.error('Saisissez des lignes, joignez un fichier (PDF, image…) ou ajoutez des notes');
      return;
    }

    setSubmitting(true);
    try {
      const result = await documentService.createPurchaseRequest({
        requesterName: requesterName.trim() || undefined,
        requesterRole: isAdmin ? 'admin' : isResponsableCommercial ? 'responsable_commercial' : undefined,
        notes: notes.trim() || undefined,
        targetRole,
        attachment_urls: [],
        items: validLines.map((line) => ({
          product_id: line.mode === 'inventory' ? line.product_id : null,
          custom_name: line.mode === 'free' ? line.custom_name : undefined,
          supplier_name: line.fournisseur_name.trim() || undefined,
          quantity: line.quantity,
          description: line.description,
        })),
      });

      if (!result.success || !result.document) {
        toast.error(result.error || 'Erreur lors de la création');
        return;
      }

      if (pendingAttachmentFiles.length > 0) {
        const uploaded = await uploadCommercialAttachments(
          pendingAttachmentFiles,
          `demande-achat/${result.document.id}`
        );
        const meta = (result.document.metadata as Record<string, unknown>) || {};
        const { error: metaErr } = await supabase
          .from('documents')
          .update({
            metadata: { ...meta, attachment_urls: uploaded },
          })
          .eq('id', result.document.id);
        if (metaErr) {
          toast.error('Demande créée mais échec des pièces jointes');
        }
      }

      toast.success('Demande d\'achat créée');
      setDialogOpen(false);
      resetForm();
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStockDecision = async (request: UnifiedDocument, decision: 'available' | 'purchase_required') => {
    const meta = (request.metadata as Record<string, unknown>) || {};
    const isStockQueue = meta.target_role === 'responsable_stock' && meta.stock_review === 'pending';

    if (isStockQueue && !isResponsableStock && !isAdmin) {
      toast.error('Seul le responsable magasin peut traiter cette demande.');
      return;
    }

    if (isResponsableStock && decision === 'available') {
      toast.error('Le responsable magasin transfère la demande uniquement vers le responsable achat.');
      return;
    }

    const confirmMessage =
      decision === 'available'
        ? 'Confirmer que le stock est disponible et clôturer la demande ?'
        : 'Confirmer que cette demande doit être transférée aux achats pour consulter les fournisseurs ?';

    if (!window.confirm(confirmMessage)) return;

    const result = await documentService.reviewPurchaseRequest(request.id, decision);
    if (result.success) {
      toast.success(
        decision === 'available'
          ? 'Demande validée par le stock'
          : 'Demande transmise au responsable achat'
      );
      await loadData();
    } else {
      toast.error(result.error || 'Erreur lors de la validation');
    }
  };

  const stockReviewLabel = (request: UnifiedDocument) => {
    const review = (request.metadata as Record<string, unknown>)?.stock_review;

    if (review === 'available') {
      return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Stock disponible</span>;
    }

    if (review === 'purchase_required') {
      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"><AlertCircle className="h-3.5 w-3.5" /> Achat nécessaire</span>;
    }

    if (review === 'bypassed') {
      return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700"><Send className="h-3.5 w-3.5" /> Envoyée aux achats</span>;
    }

    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"><Send className="h-3.5 w-3.5" /> En attente stock</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Demandes d'achat</h2>
          <p className="text-sm text-muted-foreground">
            Le responsable commercial ou l&apos;administrateur envoie la demande au responsable stock ou directement aux achats. Le responsable magasin ne peut que transférer vers les achats les demandes qui lui sont adressées.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Rechercher une demande..."
              className="pl-9"
            />
          </div>

          {canCreatePurchaseRequest ? (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <ClipboardPlus className="h-4 w-4" />
                  Nouvelle demande
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[98vw] max-w-7xl max-h-[94vh] overflow-y-auto p-5 sm:p-8">
                <DialogHeader>
                  <DialogTitle>Créer une demande d'achat</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-2">
                  <div className="rounded-xl border border-border bg-muted/20 p-4 sm:p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">Informations générales</h3>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                      <Label htmlFor="requesterName">Nom de l'agent commercial</Label>
                      <Input
                      id="requesterName"
                      value={requesterName}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requestTarget">Envoyer à</Label>
                    <Select value={targetRole} onValueChange={(value) => setTargetRole(value as 'responsable_stock' | 'responsable_achat')}>
                      <SelectTrigger id="requestTarget">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {purchaseRequestTargets.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role === 'responsable_stock' ? 'Responsable stock' : 'Responsable achat'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="requestNotes">Notes générales</Label>
                    <Textarea
                      id="requestNotes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Contexte ou besoin commercial..."
                      className="min-h-[92px]"
                    />
                  </div>
                    </div>
                </div>

                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Articles demandés</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addLine}>
                      Ajouter une ligne
                    </Button>
                  </div>

                  {lines.map((line, index) => {
                    const selectedProduct = products.find((product) => product.id === line.product_id);

                    return (
                      <div key={`${index}-${line.product_id}-${line.mode}`} className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                        <div className="grid gap-3 xl:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Mode</Label>
                            <Select
                              value={line.mode}
                              onValueChange={(value) =>
                                updateLine(index, {
                                  mode: value as 'inventory' | 'free',
                                  product_id: value === 'inventory' ? line.product_id : 0,
                                  custom_name: value === 'free' ? line.custom_name : '',
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="inventory">Inventaire</SelectItem>
                                <SelectItem value="free">Saisie libre</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Produit</Label>
                            {line.mode === 'inventory' ? (
                              <Select
                                value={line.product_id > 0 ? String(line.product_id) : ''}
                                onValueChange={(value) => updateLine(index, { product_id: Number(value) })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choisir un produit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((product) => (
                                    <SelectItem key={product.id} value={String(product.id)}>
                                      {product.name} ({product.sku}) - Stock: {product.quantity}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={line.custom_name}
                                onChange={(event) => updateLine(index, { custom_name: event.target.value })}
                                placeholder="Ex: Chaise bureau ergonomique"
                              />
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Mode fournisseur</Label>
                            <Select
                              value={line.supplier_mode}
                              onValueChange={(value) =>
                                updateLine(index, {
                                  supplier_mode: value as 'select' | 'free',
                                  fournisseur_id: value === 'select' ? line.fournisseur_id : 0,
                                  fournisseur_name: value === 'free' ? line.fournisseur_name : '',
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="select">Liste fournisseurs</SelectItem>
                                <SelectItem value="free">Saisie libre</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Fournisseur</Label>
                            {line.supplier_mode === 'select' ? (
                              <Select
                                value={line.fournisseur_id > 0 ? String(line.fournisseur_id) : ''}
                                onValueChange={(value) => {
                                  const fournisseur = fournisseurs.find((item) => item.id === Number(value));
                                  updateLine(index, {
                                    fournisseur_id: Number(value),
                                    fournisseur_name: fournisseur?.nom || '',
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choisir un fournisseur" />
                                </SelectTrigger>
                                <SelectContent>
                                  {fournisseurs.map((fournisseur) => (
                                    <SelectItem key={fournisseur.id} value={String(fournisseur.id)}>
                                      {fournisseur.nom}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={line.fournisseur_name}
                                onChange={(event) => updateLine(index, { fournisseur_name: event.target.value })}
                                placeholder="Nom du fournisseur"
                              />
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Quantité</Label>
                            <Input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(event) => updateLine(index, { quantity: Number(event.target.value) || 1 })}
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
                          <div className="space-y-2">
                            <Label>Détail</Label>
                            <Input
                              value={line.description}
                              onChange={(event) => updateLine(index, { description: event.target.value })}
                              placeholder={selectedProduct ? `Stock actuel: ${selectedProduct.quantity}` : 'Optionnel'}
                            />
                          </div>

                          <div className="flex items-end">
                            <Button type="button" variant="ghost" onClick={() => removeLine(index)} className="w-full xl:w-auto">
                              Retirer
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <CommercialAttachmentField
                label="Pièces jointes (PDF, photos, fichiers)"
                hint="Joignez un cahier des charges, une photo produit ou tout document — visible par le stock et les achats."
                existing={[]}
                pendingFiles={pendingAttachmentFiles}
                onPendingChange={setPendingAttachmentFiles}
                disabled={submitting}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="button" onClick={handleCreateRequest} disabled={submitting}>
                  {submitting ? 'Création...' : 'Enregistrer la demande'}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Seuls le responsable commercial et l&apos;administrateur peuvent créer une demande d&apos;achat.
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Répertoire des demandes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Chargement...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
              Aucune demande d'achat trouvée.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Agent commercial</TableHead>
                  <TableHead>Destinataire</TableHead>
                  <TableHead>Articles</TableHead>
                  <TableHead>Statut stock</TableHead>
                  <TableHead>Fichiers</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => {
                  const metadata = (request.metadata as Record<string, unknown>) || {};
                  const stockReview = metadata.stock_review;
                  const supplierSourcingStarted = Boolean(metadata.supplier_sourcing_started_at);
                  const targetLabel = metadata.target_role === 'responsable_achat' ? 'Responsable achat' : 'Responsable stock';

                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-semibold">{request.numero}</TableCell>
                      <TableCell>{String(metadata.requester_name || '-')}</TableCell>
                      <TableCell>{targetLabel}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {request.lines?.map((line) => (
                            <div key={line.id} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{line.product_name || line.description?.split(' | ')[0] || 'Produit'}</span>
                              {' '}x {line.quantity}
                              {getPreferredSupplier(line.description) && (
                                <span className="ml-2 text-[11px] text-primary">({getPreferredSupplier(line.description)})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{stockReviewLabel(request)}</TableCell>
                      <TableCell>
                        <CommercialAttachmentBadges metadata={metadata} />
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate" title={request.notes || getExtraDescription(request.lines?.[0]?.description) || ''}>
                        {request.notes || getExtraDescription(request.lines?.[0]?.description) || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {stockReview === 'pending' && metadata.target_role === 'responsable_stock' && (
                            isResponsableStock ? (
                              <Button
                                size="sm"
                                onClick={() => handleStockDecision(request, 'purchase_required')}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Transférer au responsable achat
                              </Button>
                            ) : isAdmin ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStockDecision(request, 'available')}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Stock OK
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleStockDecision(request, 'purchase_required')}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Transférer aux achats
                                </Button>
                              </>
                            ) : null
                          )}

                          {(stockReview === 'purchase_required' || stockReview === 'bypassed') && (
                            supplierSourcingStarted ? (
                              <span className="inline-flex items-center rounded-md bg-blue-50 px-3 text-xs font-medium text-blue-700">
                                Devis fournisseurs lancés
                              </span>
                            ) : (isResponsableAchat || isAdmin) ? (
                              <Button size="sm" variant="secondary" onClick={() => setProcurementRequest(request)}>
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Demander devis fournisseurs
                              </Button>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-muted px-3 text-xs text-muted-foreground">
                                En attente du responsable achat
                              </span>
                            )
                          )}

                          {stockReview === 'available' && (
                            <span className="inline-flex items-center rounded-md bg-green-50 px-3 text-xs font-medium text-green-700">
                              Utiliser le stock
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProcurementDialog
        open={!!procurementRequest}
        onOpenChange={(open) => !open && setProcurementRequest(null)}
        sourceBC={procurementRequest}
        onSuccess={async () => {
          setProcurementRequest(null);
          await loadData();
        }}
      />
    </div>
  );
};
