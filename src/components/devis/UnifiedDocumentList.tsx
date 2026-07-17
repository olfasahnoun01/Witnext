import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  CheckCircle, 
  Clock, 
  Truck,
  PackageCheck,
  TrendingUp,
  Package,
  ReceiptText,
  FileText,
  Trash2,
  AlertTriangle,
  Pencil,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedDocument, UnifiedDocumentStatus, UnifiedDocumentType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { documentService } from '@/modules/commercial';
import { enrichUnifiedDocumentDisplay } from '@/lib/unifiedDocumentDisplay';
import { toast } from 'sonner';
import { ReceptionDialog } from './ReceptionDialog';
import { 
  downloadUnifiedDocumentPDF 
} from '@/utils/pdfGenerator';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import {
  ensureSupabaseSessionReady,
  isAuthSessionError,
  isJwtExpiredError,
  SESSION_EXPIRED_USER_MESSAGE,
  supabaseQueryWithAuthRetry,
} from '@/lib/supabaseSession';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import {
  attachProfileNames,
  buildProfilesMap,
  collectUserIdsForProfiles,
  formatDerniereModification,
  formatModifieePar,
} from '@/lib/documentListAudit';
import { useListPagination } from '@/hooks/useListPagination';
import { ListPagination } from '@/components/shared/ListPagination';

interface UnifiedDocumentListProps {
  title?: string;
  documentTypes?: UnifiedDocumentType[];
  metadataFilter?: { key: string; value: string };
  /** When provided, shows an edit action for matching document types. */
  onEdit?: (doc: UnifiedDocument) => void;
  editableTypes?: UnifiedDocumentType[];
}

const DEFAULT_DOCUMENT_TYPES: UnifiedDocumentType[] = [
  'BC_CLIENT',
  'DEVIS_FOURNISSEUR',
  'BC_FOURNISSEUR',
  'BL_FOURNISSEUR',
  'BE',
  'BS',
  'BL_CLIENT',
  'FACTURE',
];

export const UnifiedDocumentList = ({
  title = 'Gestion des Achats & Ventes',
  documentTypes = DEFAULT_DOCUMENT_TYPES,
  metadataFilter,
  onEdit,
  editableTypes = ['BL_CLIENT'],
}: UnifiedDocumentListProps) => {
  const { user, isAdmin, isModerator } = useAuth();
  const { canAccessSubsection } = usePermissions();
  const [documents, setDocuments] = useState<UnifiedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [receptionBC, setReceptionBC] = useState<UnifiedDocument | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [invoicedBlIds, setInvoicedBlIds] = useState<Set<string>>(new Set());

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const ready = await ensureSupabaseSessionReady();
      if (!ready) {
        toast.error(SESSION_EXPIRED_USER_MESSAGE);
        return;
      }

      const runDocumentsQuery = () => {
        let query = supabase
          .from('documents')
          .select(`
          *,
          fournisseurs(nom),
          clients(nom),
          document_lines(
            *,
            products(name)
          )
        `)
          .in('type', documentTypes);

        if (metadataFilter) {
          query = query.filter(`metadata->>${metadataFilter.key}`, 'eq', metadataFilter.value);
        }

        return query.order('created_at', { ascending: false }).limit(500);
      };

      const { data, error } = await supabaseQueryWithAuthRetry(runDocumentsQuery);

      if (error) throw error;
      
      let mapped = data.map((d) =>
        enrichUnifiedDocumentDisplay({
          ...d,
          fournisseur_name: d.fournisseurs?.nom,
          client_name: d.clients?.nom,
          lines: d.document_lines,
        } as UnifiedDocument)
      );

      const userIds = collectUserIdsForProfiles(mapped);
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabaseQueryWithAuthRetry(() =>
          supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds)
        );
        if (profilesError) {
          console.warn('[UnifiedDocumentList] profiles load failed:', profilesError.message);
        } else if (profiles?.length) {
          const profilesMap = buildProfilesMap(profiles);
          mapped = mapped.map((doc) => attachProfileNames(doc, profilesMap));
        }
      }

      setDocuments(mapped);

      if (documentTypes.includes('BL_CLIENT')) {
        const blIds = mapped.filter((d) => d.type === 'BL_CLIENT').map((d) => d.id);
        const invoiced = await documentService.fetchBlIdsWithInvoice(blIds);
        setInvoicedBlIds(invoiced);
      } else {
        setInvoicedBlIds(new Set());
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        isJwtExpiredError(message) || isAuthSessionError(message)
          ? SESSION_EXPIRED_USER_MESSAGE
          : `Erreur lors du chargement : ${message}`
      );
    } finally {
      setLoading(false);
    }
  }, [documentTypes, metadataFilter]);

  const canEditDocument = useCallback(
    (doc: UnifiedDocument): boolean => {
      if (!onEdit || !editableTypes.includes(doc.type)) return false;
      if (doc.type === 'BL_CLIENT' && invoicedBlIds.has(doc.id)) return false;
      if (isAdmin || isModerator) return true;
      if (user?.id && doc.created_by === user.id) return true;
      if (doc.type === 'BL_CLIENT') return canAccessSubsection('bl-magasin');
      return false;
    },
    [onEdit, editableTypes, invoicedBlIds, isAdmin, isModerator, user?.id, canAccessSubsection]
  );

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useSessionResumeReload(loadDocuments);
  useCompanyChangeReload(loadDocuments);

  const handleDownloadPDF = async (doc: UnifiedDocument) => {
    try {
      toast.info("Génération du PDF...");
      await downloadUnifiedDocumentPDF(doc);
    } catch (error: any) {
      toast.error("Erreur PDF : " + error.message);
    }
  };

  const handleCreateFacture = async (blId: string) => {
    const confirm = window.confirm("Générer la facture finale de cette livraison ?");
    if (!confirm) return;

    const result = await documentService.createInvoiceFromBL(blId);
    if (result.success) {
      toast.success("Facture générée avec succès !");
      loadDocuments();
    } else {
      toast.error("Erreur : " + result.error);
    }
  };

  const handleValidateClientBC = async (id: string) => {
    const confirm = window.confirm("Vérifier le stock et lancer la livraison ?");
    if (!confirm) return;

    const result = await documentService.validateClientBC(id);
    if (result.success) {
      toast.success("Livraison lancée ! BL et BS générés.");
      loadDocuments();
    } else {
      toast.error("Erreur : " + result.error);
    }
  };

  const handleValidateBS = async (id: string) => {
    const confirm = window.confirm("Valider la sortie de stock ? Cette action est irréversible.");
    if (!confirm) return;

    const result = await documentService.validateBS(id);
    if (result.success) {
      toast.success("Stock décrémenté avec succès !");
      loadDocuments();
    } else {
      toast.error("Erreur : " + result.error);
    }
  };

  const handleAcceptQuote = async (id: string) => {
    const confirm = window.confirm("Accepter ce devis et générer le Bon de Commande Fournisseur ?");
    if (!confirm) return;

    const result = await documentService.acceptSupplierQuote(id);
    if (result.success) {
      toast.success("Devis accepté ! Bon de commande généré.");
      loadDocuments();
    } else {
      toast.error("Erreur : " + result.error);
    }
  };

  const handleValidateBE = async (id: string) => {
    const confirm = window.confirm("Valider cette entrée en stock ? Cette action est irréversible.");
    if (!confirm) return;

    const result = await documentService.validateBE(id);
    if (result.success) {
      toast.success("Stock mis à jour avec succès !");
      loadDocuments();
    } else {
      toast.error("Erreur : " + result.error);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    const result = await documentService.deleteDocument(deleteId);
    if (result.success) {
      toast.success("Document supprimé avec succès.");
      loadDocuments();
    } else {
      toast.error("Erreur lors de la suppression : " + result.error);
    }
    setIsDeleting(false);
    setDeleteId(null);
  };

  const getStatusBadge = (status: UnifiedDocumentStatus) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">En attente</Badge>;
      case 'VALIDATED': return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Validé</Badge>;
      case 'REJECTED': return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Rejeté</Badge>;
      case 'COMPLETED': return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Terminé</Badge>;
      case 'PARTIALLY_RECEIVED': return <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-200">Partiellement Reçu</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredDocs = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.fournisseur_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [documents, searchTerm]
  );

  const {
    slice: docsPage,
    page,
    totalPages,
    total,
    from,
    to,
    setPage,
  } = useListPagination(filteredDocs, searchTerm);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">Chargement...</div>
        ) : filteredDocs.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-muted/20 rounded-xl border border-dashed">
            Aucun document trouvé.
          </div>
        ) : docsPage.map((doc) => (
          <Card key={doc.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-3 border-b bg-muted/10">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      {doc.type === 'DEMANDE_ACHAT' && 'DEMANDE D\'ACHAT'}
                      {doc.type === 'BC_CLIENT' && 'BC CLIENT'}
                      {doc.type === 'DEVIS_FOURNISSEUR' && 'DEVIS FOURNISSEUR'}
                      {doc.type === 'BC_FOURNISSEUR' && 'BC FOURNISSEUR'}
                      {doc.type === 'BL_FOURNISSEUR' && 'BL FOURNISSEUR'}
                      {doc.type === 'BE' && 'BON D\'ENTRÉE'}
                      {doc.type === 'BS' && 'BON DE SORTIE'}
                      {doc.type === 'BL_CLIENT' && 'BL CLIENT'}
                      {doc.type === 'FACTURE' && 'FACTURE'}
                    </span>
                    {getStatusBadge(doc.status)}
                  </div>
                  <CardTitle className="text-lg font-bold">{doc.numero}</CardTitle>
                </div>
                <div className={cn(
                  "p-2 bg-background rounded-lg border shadow-sm",
                  doc.type === 'BS' ? "text-red-500" : (doc.type === 'BE' ? "text-green-500" : (doc.type === 'FACTURE' ? "text-indigo-600" : "text-primary"))
                )}>
                   {doc.type === 'DEMANDE_ACHAT' && <Package className="w-5 h-5" />}
                   {doc.type === 'DEVIS_FOURNISSEUR' && <Clock className="w-5 h-5" />}
                   {doc.type === 'BC_FOURNISSEUR' && <Truck className="w-5 h-5" />}
                   {doc.type === 'BC_CLIENT' && <Package className="w-5 h-5" />}
                   {doc.type === 'BE' && <PackageCheck className="w-5 h-5" />}
                   {doc.type === 'BS' && <TrendingUp className="w-5 h-5" />}
                   {doc.type === 'FACTURE' && <ReceiptText className="w-5 h-5" />}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(doc.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {(doc.type === 'BC_CLIENT' || doc.type === 'BC_FOURNISSEUR') ? (
                <>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-muted-foreground shrink-0">Client :</span>
                    <span className="font-medium text-right">{doc.client_name || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-muted-foreground shrink-0">Fournisseur :</span>
                    <span className="font-bold text-right">{doc.fournisseur_name || '—'}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tiers :</span>
                  <span className="font-bold">{doc.fournisseur_name || doc.client_name || 'N/A'}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Articles :</span>
                <span>{doc.lines?.length || 0} articles</span>
              </div>
              <div className="flex justify-between text-sm gap-2">
                <span className="text-muted-foreground shrink-0">Dernière modification :</span>
                <span className="text-right text-xs">{formatDerniereModification(doc)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Modifiée par :</span>
                <span className="font-medium">{formatModifieePar(doc)}</span>
              </div>

              <div className="pt-2 space-y-2">
                {canEditDocument(doc) && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => onEdit?.(doc)}
                  >
                    <Pencil className="w-4 h-4" />
                    MODIFIER
                  </Button>
                )}

                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => handleDownloadPDF(doc)}
                >
                  <FileText className="w-4 h-4" />
                  TÉLÉCHARGER PDF
                </Button>

                {doc.type === 'BL_CLIENT' && (
                  <Button 
                    variant="default" 
                    className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
                    disabled={invoicedBlIds.has(doc.id)}
                    onClick={() => handleCreateFacture(doc.id)}
                  >
                    <ReceiptText className="w-4 h-4" />
                    {invoicedBlIds.has(doc.id) ? 'DÉJÀ FACTURÉ' : 'GÉNÉRER FACTURE'}
                  </Button>
                )}

                {doc.type === 'BC_CLIENT' && doc.status === 'VALIDATED' && (
                  <Button 
                    variant="default" 
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleValidateClientBC(doc.id)}
                  >
                    <Truck className="w-4 h-4" />
                    LANCER LIVRAISON
                  </Button>
                )}

                {doc.type === 'DEVIS_FOURNISSEUR' && doc.status === 'PENDING' && (
                  <Button 
                    variant="default" 
                    className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => handleAcceptQuote(doc.id)}
                  >
                    <CheckCircle className="w-4 h-4" />
                    ACCEPTER CE DEVIS
                  </Button>
                )}
                
                {(doc.type === 'BC_FOURNISSEUR' && (doc.status === 'PENDING' || doc.status === 'PARTIALLY_RECEIVED')) && (
                  <Button 
                    variant="default" 
                    className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
                    onClick={() => setReceptionBC(doc)}
                  >
                    <Truck className="w-4 h-4" />
                    RÉCEPTIONNER
                  </Button>
                )}

                {doc.type === 'BE' && doc.status === 'PENDING' && (
                  <Button 
                    variant="default" 
                    className="w-full gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => handleValidateBE(doc.id)}
                  >
                    <PackageCheck className="w-4 h-4" />
                    VALIDER ENTRÉE STOCK
                  </Button>
                )}

                {doc.type === 'BS' && doc.status === 'PENDING' && (
                  <Button 
                    variant="default" 
                    className="w-full gap-2 bg-red-600 hover:bg-red-700"
                    onClick={() => handleValidateBS(doc.id)}
                  >
                    <TrendingUp className="w-4 h-4" />
                    VALIDER SORTIE STOCK
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && (
        <ListPagination
          page={page}
          totalPages={totalPages}
          total={total}
          from={from}
          to={to}
          onPageChange={setPage}
        />
      )}

      <ReceptionDialog 
        open={!!receptionBC} 
        onOpenChange={(open) => !open && setReceptionBC(null)}
        sourceBC={receptionBC}
        onSuccess={loadDocuments}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Confirmation de suppression
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible et supprimera également toutes les lignes associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
