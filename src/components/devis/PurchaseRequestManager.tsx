import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPlus,
  Download,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { documentService } from '@/modules/commercial';
import { UnifiedDocument } from '@/types';
import { ProcurementDialog } from './ProcurementDialog';
import {
  downloadPurchaseRequestPDF,
  parsePurchaseRequestLineDescription,
} from '@/utils/purchaseRequestPdf';

interface SupplierOption {
  id: number;
  nom: string;
}

interface PurchaseRequestLine {
  article_name: string;
  fournisseur_name: string;
  description: string;
  size: string;
  quantity: number;
}

const emptyLine = (): PurchaseRequestLine => ({
  article_name: '',
  fournisseur_name: '',
  description: '',
  size: '',
  quantity: 1,
});

const normalizePosteKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

export const PurchaseRequestManager = () => {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<UnifiedDocument[]>([]);
  const [fournisseurs, setFournisseurs] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [targetRole, setTargetRole] = useState<'responsable_stock' | 'responsable_achat'>(
    'responsable_stock'
  );
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PurchaseRequestLine[]>([]);
  const [draft, setDraft] = useState<PurchaseRequestLine>(emptyLine());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [procurementRequest, setProcurementRequest] = useState<UnifiedDocument | null>(null);

  const currentUserPosition = String(
    user?.user_metadata?.position || user?.user_metadata?.role || ''
  ).trim();
  const currentUserPositionKey = normalizePosteKey(currentUserPosition);
  const isResponsableStock =
    currentUserPositionKey === 'responsable magazin' ||
    currentUserPositionKey === 'responsable magasin' ||
    currentUserPositionKey === 'responsable stock';
  const isResponsableAchat = currentUserPositionKey === 'responsable achat';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: docs, error: docsError },
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
        supabase.from('fournisseurs').select('id, nom').order('created_at', { ascending: false }),
      ]);

      if (docsError) throw docsError;
      if (fournisseursError) throw fournisseursError;

      const mappedRequests = (docs || []).map((doc) => ({
        ...doc,
        lines: (doc.document_lines || []).map((line: {
          products?: { name?: string; sku?: string; quantity?: number };
          description?: string | null;
        }) => ({
          ...line,
          product_name: line.products?.name,
          product_sku: line.products?.sku,
          available_quantity: line.products?.quantity ?? 0,
        })),
      })) as UnifiedDocument[];

      setRequests(mappedRequests);
      setFournisseurs((fournisseursData || []) as SupplierOption[]);
    } catch (error: unknown) {
      console.error('Error loading purchase requests:', error);
      toast.error("Erreur lors du chargement des demandes d'achat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const loadRequesterName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const resolvedName =
        data?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      setRequesterName(resolvedName);
    };

    void loadRequesterName();
  }, [user]);

  const resetForm = useCallback(() => {
    setRequesterName(
      user?.user_metadata?.full_name || user?.email?.split('@')[0] || requesterName || ''
    );
    setTargetRole('responsable_stock');
    setNotes('');
    setLines([]);
    setDraft(emptyLine());
    setEditingIndex(null);
  }, [user, requesterName]);

  const updateDraft = (patch: Partial<PurchaseRequestLine>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const commitDraft = () => {
    if (!draft.article_name.trim()) {
      toast.error("Indiquez le nom de l'article.");
      return;
    }
    if (!draft.fournisseur_name.trim()) {
      toast.error('Indiquez le fournisseur.');
      return;
    }
    if (draft.quantity < 1) {
      toast.error('La quantité doit être au moins 1.');
      return;
    }

    const committed: PurchaseRequestLine = {
      article_name: draft.article_name.trim(),
      fournisseur_name: draft.fournisseur_name.trim(),
      description: draft.description.trim(),
      size: draft.size.trim(),
      quantity: Math.max(1, draft.quantity),
    };

    if (editingIndex != null) {
      setLines((prev) => prev.map((line, idx) => (idx === editingIndex ? committed : line)));
      setEditingIndex(null);
      toast.success('Article mis à jour');
    } else {
      setLines((prev) => [...prev, committed]);
      toast.success('Article ajouté à la liste');
    }
    setDraft(emptyLine());
  };

  const editLine = (index: number) => {
    const line = lines[index];
    if (!line) return;
    setDraft({ ...line });
    setEditingIndex(index);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
    if (editingIndex === index) {
      setDraft(emptyLine());
      setEditingIndex(null);
    } else if (editingIndex != null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const cancelEdit = () => {
    setDraft(emptyLine());
    setEditingIndex(null);
  };

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return requests;

    return requests.filter((request) => {
      const requester = String(
        (request.metadata as Record<string, unknown>)?.requester_name || ''
      ).toLowerCase();
      const stockReview = String(
        (request.metadata as Record<string, unknown>)?.stock_review || ''
      ).toLowerCase();
      return (
        request.numero.toLowerCase().includes(term) ||
        requester.includes(term) ||
        stockReview.includes(term)
      );
    });
  }, [requests, searchTerm]);

  const handleCreateRequest = async (andPrint: boolean) => {
    if (!user) {
      toast.error('Connectez-vous pour créer une demande.');
      return;
    }

    const validLines = lines.filter(
      (line) =>
        line.quantity > 0 &&
        line.article_name.trim().length > 0 &&
        line.fournisseur_name.trim().length > 0
    );

    if (validLines.length === 0) {
      toast.error('Ajoutez au moins un article à la liste avant de valider.');
      return;
    }

    if (
      draft.article_name.trim() ||
      draft.fournisseur_name.trim() ||
      draft.description.trim() ||
      draft.size.trim()
    ) {
      toast.error(
        'Un article est encore en cours de saisie. Cliquez « Ajouter à la liste » ou videz le formulaire.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await documentService.createPurchaseRequest({
        requesterName: requesterName.trim() || undefined,
        requesterRole: isAdmin ? 'admin' : currentUserPosition || 'user',
        notes: notes.trim() || undefined,
        targetRole,
        attachment_urls: [],
        items: validLines.map((line) => ({
          product_id: null,
          custom_name: line.article_name.trim(),
          supplier_name: line.fournisseur_name.trim(),
          size: line.size.trim() || undefined,
          quantity: line.quantity,
          description: line.description.trim() || undefined,
        })),
      });

      if (!result.success || !result.document) {
        toast.error(result.error || 'Erreur lors de la création');
        return;
      }

      toast.success("Demande d'achat créée");

      if (andPrint) {
        const fullDoc: UnifiedDocument = {
          ...(result.document as UnifiedDocument),
          lines: validLines.map((line, idx) => ({
            id: String(idx),
            document_id: result.document!.id,
            product_id: null,
            quantity: line.quantity,
            unit_price: 0,
            total_price: 0,
            description: [
              line.article_name.trim(),
              `Fournisseur: ${line.fournisseur_name.trim()}`,
              line.size.trim() ? `Taille: ${line.size.trim()}` : '',
              line.description.trim(),
            ]
              .filter(Boolean)
              .join(' | '),
            product_name: line.article_name.trim(),
          })),
          notes: notes.trim() || null,
          metadata: {
            ...((result.document as UnifiedDocument).metadata || {}),
            requester_name: requesterName.trim(),
            target_role: targetRole,
          },
        };
        await downloadPurchaseRequestPDF(fullDoc);
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStockDecision = async (
    request: UnifiedDocument,
    decision: 'available' | 'purchase_required'
  ) => {
    const meta = (request.metadata as Record<string, unknown>) || {};
    const isStockQueue =
      meta.target_role === 'responsable_stock' && meta.stock_review === 'pending';

    if (isStockQueue && !isResponsableStock && !isAdmin) {
      toast.error('Seul le responsable magasin peut traiter cette demande.');
      return;
    }

    if (isResponsableStock && decision === 'available') {
      toast.error(
        'Le responsable magasin transfère la demande uniquement vers le responsable achat.'
      );
      return;
    }

    const confirmMessage =
      decision === 'available'
        ? 'Confirmer que le stock est disponible et clôturer la demande ?'
        : 'Confirmer que cette demande doit être transférée aux achats ?';

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
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Stock disponible
        </span>
      );
    }

    if (review === 'purchase_required') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
          <AlertCircle className="h-3.5 w-3.5" /> Achat nécessaire
        </span>
      );
    }

    if (review === 'bypassed') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
          <Send className="h-3.5 w-3.5" /> Envoyée aux achats
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
        <Send className="h-3.5 w-3.5" /> En attente stock
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Demandes d&apos;achat</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Créez une demande simple : article, fournisseur, description, taille et quantité.
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
            <DialogContent className="w-[98vw] max-w-3xl max-h-[94vh] overflow-y-auto p-5 sm:p-8">
              <DialogHeader>
                <DialogTitle>Nouvelle demande d&apos;achat</DialogTitle>
                <DialogDescription>
                  Remplissez les articles puis validez pour enregistrer et imprimer le PDF.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="requesterName">Demandeur</Label>
                    <Input id="requesterName" value={requesterName} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requestTarget">Envoyer à</Label>
                    <Select
                      value={targetRole}
                      onValueChange={(value) =>
                        setTargetRole(value as 'responsable_stock' | 'responsable_achat')
                      }
                    >
                      <SelectTrigger id="requestTarget">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="responsable_stock">Responsable stock</SelectItem>
                        <SelectItem value="responsable_achat">Responsable achat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      {editingIndex != null
                        ? `Modifier l'article #${editingIndex + 1}`
                        : 'Saisir un article'}
                    </h3>
                    {editingIndex != null ? (
                      <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                        Annuler la modification
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="da-article">Nom de l&apos;article *</Label>
                      <Input
                        id="da-article"
                        value={draft.article_name}
                        onChange={(e) => updateDraft({ article_name: e.target.value })}
                        placeholder="Ex: Polo blanc"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitDraft();
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="da-fournisseur">Fournisseur *</Label>
                      <Input
                        id="da-fournisseur"
                        list="fournisseurs-da-draft"
                        value={draft.fournisseur_name}
                        onChange={(e) => updateDraft({ fournisseur_name: e.target.value })}
                        placeholder="Saisie libre ou catalogue"
                        autoComplete="off"
                      />
                      <datalist id="fournisseurs-da-draft">
                        {fournisseurs.map((f) => (
                          <option key={f.id} value={f.nom} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="da-size">Taille</Label>
                      <Input
                        id="da-size"
                        value={draft.size}
                        onChange={(e) => updateDraft({ size: e.target.value })}
                        placeholder="Ex: L, 42, XL…"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="da-desc">Description</Label>
                      <Input
                        id="da-desc"
                        value={draft.description}
                        onChange={(e) => updateDraft({ description: e.target.value })}
                        placeholder="Couleur, références, détails…"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="da-qty">Quantité *</Label>
                      <Input
                        id="da-qty"
                        type="number"
                        min={1}
                        value={draft.quantity}
                        onChange={(e) =>
                          updateDraft({ quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" className="w-full gap-2" onClick={commitDraft}>
                        <Plus className="h-4 w-4" />
                        {editingIndex != null ? 'Mettre à jour' : 'Ajouter à la liste'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      Articles de la demande
                      {lines.length > 0 ? (
                        <span className="ml-2 text-muted-foreground font-normal">
                          ({lines.length})
                        </span>
                      ) : null}
                    </Label>
                  </div>

                  {lines.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                      Aucun article pour l&apos;instant — saisissez ci-dessus puis cliquez
                      « Ajouter à la liste ».
                    </div>
                  ) : (
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Article</TableHead>
                            <TableHead>Fournisseur</TableHead>
                            <TableHead>Taille</TableHead>
                            <TableHead className="w-16 text-center">Qté</TableHead>
                            <TableHead className="w-24 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, index) => (
                            <TableRow
                              key={`${line.article_name}-${index}`}
                              className={
                                editingIndex === index ? 'bg-primary/5' : undefined
                              }
                            >
                              <TableCell className="text-muted-foreground text-xs">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{line.article_name}</div>
                                {line.description ? (
                                  <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                    {line.description}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-sm">{line.fournisseur_name}</TableCell>
                              <TableCell className="text-sm">{line.size || '—'}</TableCell>
                              <TableCell className="text-center font-semibold">
                                {line.quantity}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() => editLine(index)}
                                  >
                                    Modifier
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => removeLine(index)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requestNotes">Notes (optionnel)</Label>
                  <Textarea
                    id="requestNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contexte, urgence…"
                    className="min-h-[72px]"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleCreateRequest(false)}
                  disabled={submitting || lines.length === 0}
                >
                  {submitting ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleCreateRequest(true)}
                  disabled={submitting || lines.length === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {submitting ? '…' : 'Valider & PDF'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              Aucune demande d&apos;achat trouvée.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Demandeur</TableHead>
                  <TableHead>Articles</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => {
                  const metadata = (request.metadata as Record<string, unknown>) || {};
                  const stockReview = metadata.stock_review;
                  const supplierSourcingStarted = Boolean(metadata.supplier_sourcing_started_at);

                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-semibold">{request.numero}</TableCell>
                      <TableCell>{String(metadata.requester_name || '—')}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {request.lines?.map((line) => {
                            const parsed = parsePurchaseRequestLineDescription(
                              line.description || line.product_name
                            );
                            return (
                              <div key={line.id} className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {line.product_name || parsed.articleName}
                                </span>
                                {' '}
                                × {line.quantity}
                                {parsed.size ? (
                                  <span className="ml-1">· {parsed.size}</span>
                                ) : null}
                                {parsed.supplier ? (
                                  <span className="ml-2 text-[11px] text-primary">
                                    ({parsed.supplier})
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>{stockReviewLabel(request)}</TableCell>
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={request.notes || ''}
                      >
                        {request.notes || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => void downloadPurchaseRequestPDF(request)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </Button>

                          {stockReview === 'pending' &&
                            metadata.target_role === 'responsable_stock' &&
                            (isResponsableStock ? (
                              <Button
                                size="sm"
                                onClick={() =>
                                  void handleStockDecision(request, 'purchase_required')
                                }
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Transférer aux achats
                              </Button>
                            ) : isAdmin ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleStockDecision(request, 'available')}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Stock OK
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    void handleStockDecision(request, 'purchase_required')
                                  }
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Transférer
                                </Button>
                              </>
                            ) : null)}

                          {(stockReview === 'purchase_required' || stockReview === 'bypassed') &&
                            (supplierSourcingStarted ? (
                              <span className="inline-flex items-center rounded-md bg-blue-50 px-3 text-xs font-medium text-blue-700">
                                Devis fournisseurs lancés
                              </span>
                            ) : isResponsableAchat || isAdmin ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setProcurementRequest(request)}
                              >
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Devis fournisseurs
                              </Button>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-muted px-3 text-xs text-muted-foreground">
                                En attente achat
                              </span>
                            ))}

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
