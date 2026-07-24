import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Plus, Store, Users } from 'lucide-react';
import { UnifiedDocumentList } from '../devis/UnifiedDocumentList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentCreationDialog } from './DocumentCreationDialog';
import { UnifiedDocument, UnifiedDocumentType } from '@/types';
import {
  readPendingWarehouseDocument,
  type PendingWarehouseDocument,
} from '@/lib/appNavigationStorage';
import { getActiveCompanyIdForQuery } from '@/lib/activeCompany';

export type DeliveryNoteTab = 'client' | 'fournisseur' | 'intermagasin';
type LockedBlPurpose = 'client' | 'magasin_transfer';

type TabConfig = {
  id: DeliveryNoteTab;
  label: string;
  shortLabel: string;
  icon: typeof Users;
  documentType: UnifiedDocumentType;
  createLabel: string;
  listTitle: string;
  lockedBlPurpose?: LockedBlPurpose;
  metadataFilter?: {
    key: string;
    value: string;
    mode?: 'eq' | 'neq_or_null';
  };
};

const TABS: TabConfig[] = [
  {
    id: 'client',
    label: 'Client',
    shortLabel: 'Client',
    icon: Users,
    documentType: 'BL_CLIENT',
    createLabel: 'Créer un BL client',
    listTitle: 'Bons de livraison — Client',
    lockedBlPurpose: 'client',
    metadataFilter: {
      key: 'bl_purpose',
      value: 'magasin_transfer',
      mode: 'neq_or_null',
    },
  },
  {
    id: 'fournisseur',
    label: 'Fournisseur',
    shortLabel: 'Fournisseur',
    icon: Building2,
    documentType: 'BL_FOURNISSEUR',
    createLabel: 'Créer un BL fournisseur',
    listTitle: 'Bons de livraison — Fournisseur',
    metadataFilter: { key: 'bl_purpose', value: 'envoi_faconnage' },
  },
  {
    id: 'intermagasin',
    label: 'Intermagasin',
    shortLabel: 'Intermagasin',
    icon: Store,
    documentType: 'BL_CLIENT',
    createLabel: 'Créer un BL intermagasin',
    listTitle: 'Bons de livraison — Intermagasin',
    lockedBlPurpose: 'magasin_transfer',
    metadataFilter: { key: 'bl_purpose', value: 'magasin_transfer' },
  },
];

function parseTab(value: string | null): DeliveryNoteTab {
  if (value === 'fournisseur' || value === 'intermagasin' || value === 'client') return value;
  return 'client';
}

function tabForDocument(doc: UnifiedDocument): DeliveryNoteTab {
  if (doc.type === 'BL_FOURNISSEUR') return 'fournisseur';
  const purpose = (doc.metadata as Record<string, unknown> | undefined)?.bl_purpose;
  if (purpose === 'magasin_transfer') return 'intermagasin';
  return 'client';
}

export const WarehouseDeliveryNotesManager = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));
  const tabConfig = useMemo(
    () => TABS.find((t) => t.id === activeTab) ?? TABS[0],
    [activeTab]
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [dialogType, setDialogType] = useState<UnifiedDocumentType>('BL_CLIENT');
  const [dialogLockedPurpose, setDialogLockedPurpose] = useState<LockedBlPurpose | null>('client');
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingFromTransaction, setPendingFromTransaction] =
    useState<PendingWarehouseDocument | null>(null);

  useEffect(() => {
    const companyId = getActiveCompanyIdForQuery();
    const pending = readPendingWarehouseDocument(companyId);
    if (!pending) return;

    if (pending.type === 'BL_FOURNISSEUR') {
      setSearchParams({ tab: 'fournisseur' }, { replace: true });
      setDialogType('BL_FOURNISSEUR');
      setDialogLockedPurpose(null);
      setPendingFromTransaction(pending);
      setIsCreateOpen(true);
      return;
    }
    if (pending.type === 'BL_CLIENT') {
      setSearchParams({ tab: 'client' }, { replace: true });
      setDialogType('BL_CLIENT');
      setDialogLockedPurpose('client');
      setPendingFromTransaction(pending);
      setIsCreateOpen(true);
    }
  }, [setSearchParams]);

  const handleTabChange = (value: string) => {
    const next = parseTab(value);
    setSearchParams(next === 'client' ? {} : { tab: next }, { replace: true });
    setIsCreateOpen(false);
    setEditDocumentId(null);
    setPendingFromTransaction(null);
  };

  const handleSuccess = () => {
    setPendingFromTransaction(null);
    setEditDocumentId(null);
    setRefreshKey((prev) => prev + 1);
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
    const tab = tabForDocument(doc);
    const cfg = TABS.find((t) => t.id === tab) ?? TABS[0];
    setSearchParams(tab === 'client' ? {} : { tab }, { replace: true });
    setDialogType(cfg.documentType);
    setDialogLockedPurpose(cfg.lockedBlPurpose ?? null);
    setEditDocumentId(doc.id);
    setIsCreateOpen(true);
  };

  const handleCreateClick = () => {
    setEditDocumentId(null);
    setPendingFromTransaction(null);
    setDialogType(tabConfig.documentType);
    setDialogLockedPurpose(tabConfig.lockedBlPurpose ?? null);
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      {pendingFromTransaction && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Une transaction stock vient d&apos;être enregistrée. Vous devez créer le bon de livraison
          correspondant pour finaliser l&apos;opération.
        </div>
      )}

      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Bons de livraison</h2>
        <p className="text-sm text-muted-foreground">
          Choisissez le type de bon, puis consultez la liste ou créez un nouveau document.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-2 py-2.5 data-[state=active]:shadow-sm"
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-4 mt-0">
            <div className="flex justify-end">
              <Button onClick={handleCreateClick} className="gap-2">
                <Plus className="w-4 h-4" />
                {tab.createLabel}
              </Button>
            </div>

            {activeTab === tab.id && (
              <UnifiedDocumentList
                key={`${tab.id}-${refreshKey}`}
                title={tab.listTitle}
                documentTypes={[tab.documentType]}
                metadataFilter={tab.metadataFilter}
                onEdit={handleEditDocument}
                editableTypes={['BL_CLIENT', 'BL_FOURNISSEUR']}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <DocumentCreationDialog
        open={isCreateOpen}
        onOpenChange={handleOpenChange}
        type={dialogType}
        onSuccess={handleSuccess}
        initialData={
          pendingFromTransaction?.type === dialogType ? pendingFromTransaction : null
        }
        mandatory={!!pendingFromTransaction && pendingFromTransaction.type === dialogType}
        editDocumentId={editDocumentId}
        lockedBlPurpose={dialogLockedPurpose}
      />
    </div>
  );
};
