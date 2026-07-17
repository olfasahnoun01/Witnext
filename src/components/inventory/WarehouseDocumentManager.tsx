import { useState, useEffect } from 'react';
import { UnifiedDocumentList } from '../devis/UnifiedDocumentList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DocumentCreationDialog } from './DocumentCreationDialog';
import { UnifiedDocument, UnifiedDocumentType } from '@/types';
import {
  readPendingWarehouseDocument,
  type PendingWarehouseDocument,
} from '@/lib/appNavigationStorage';
import { getActiveCompanyIdForQuery } from '@/lib/activeCompany';

interface WarehouseDocumentManagerProps {
  type: UnifiedDocumentType;
  title: string;
}

export const WarehouseDocumentManager = ({
  type,
  title,
}: WarehouseDocumentManagerProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingFromTransaction, setPendingFromTransaction] =
    useState<PendingWarehouseDocument | null>(null);

  useEffect(() => {
    const companyId = getActiveCompanyIdForQuery();
    const pending = readPendingWarehouseDocument(companyId);
    if (pending && pending.type === type) {
      setPendingFromTransaction(pending);
      setIsCreateOpen(true);
    }
  }, [type]);

  const handleSuccess = () => {
    setPendingFromTransaction(null);
    setEditDocumentId(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleOpenChange = (open: boolean) => {
    const companyId = getActiveCompanyIdForQuery();
    if (!open && pendingFromTransaction && readPendingWarehouseDocument(companyId)) {
      return;
    }
    setIsCreateOpen(open);
    if (!open) {
      setPendingFromTransaction(null);
      setEditDocumentId(null);
    }
  };

  const handleEditDocument = (doc: UnifiedDocument) => {
    setEditDocumentId(doc.id);
    setIsCreateOpen(true);
  };

  const handleCreateClick = () => {
    setEditDocumentId(null);
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      {pendingFromTransaction && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Une transaction stock vient d&apos;être enregistrée. Vous devez créer le{' '}
          {type === 'BE' ? "bon d'entrée" : 'bon de sortie'} correspondant pour finaliser
          l&apos;opération.
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleCreateClick} className="gap-2">
          <Plus className="w-4 h-4" />
          Nouveau Document
        </Button>
      </div>

      <UnifiedDocumentList 
        key={refreshKey}
        title={title}
        documentTypes={[type]}
        onEdit={type === 'BL_CLIENT' ? handleEditDocument : undefined}
        editableTypes={type === 'BL_CLIENT' ? ['BL_CLIENT'] : undefined}
      />

      <DocumentCreationDialog 
        open={isCreateOpen}
        onOpenChange={handleOpenChange}
        type={type}
        onSuccess={handleSuccess}
        initialData={pendingFromTransaction}
        mandatory={!!pendingFromTransaction}
        editDocumentId={editDocumentId}
      />
    </div>
  );
};
