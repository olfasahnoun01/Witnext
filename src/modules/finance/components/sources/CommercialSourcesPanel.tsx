import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  FileText,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMontantDt } from '../../lib/money';
import { paginateList } from '../../lib/pagination';
import { FinanceListPagination } from '../shared/FinanceListPagination';
import {
  createFinanceInvoiceFromDevis,
  createFinanceInvoiceFromDocument,
  createFinanceInvoiceFromGroupedDocuments,
  fetchClientsDirectory,
  fetchCommercialDevisList,
  fetchFournisseursDirectory,
  fetchWarehouseDocuments,
} from '../../services/commercialBridgeApi';
import {
  DEVIS_KIND_LABELS,
  WAREHOUSE_DOC_LABELS,
  type CommercialDevisRow,
  type TierDirectoryRow,
  type WarehouseDocType,
  type WarehouseDocumentRow,
} from '../../types/commercialBridge';

type MagasinDocFilter = Extract<WarehouseDocType, 'BL_CLIENT' | 'BL_FOURNISSEUR' | 'BE' | 'BS'>;

const MAGASIN_DOC_OPTIONS: Array<{
  type: MagasinDocFilter;
  label: string;
  shortLabel: string;
  purchasesOnly?: boolean;
}> = [
  { type: 'BL_CLIENT', label: 'BL client — bons de livraison', shortLabel: 'BL client' },
  { type: 'BL_FOURNISSEUR', label: 'BL fournisseur — réceptions', shortLabel: 'BL fournisseur', purchasesOnly: true },
  { type: 'BE', label: "BE — bons d'entrée magasin", shortLabel: 'BE' },
  { type: 'BS', label: 'BS — bons de sortie magasin', shortLabel: 'BS' },
];

function defaultMagasinSelection(showPurchases: boolean): MagasinDocFilter[] {
  return MAGASIN_DOC_OPTIONS.filter((o) => showPurchases || !o.purchasesOnly).map((o) => o.type);
}

interface CommercialSourcesPanelProps {
  companyId: string;
  showPurchases: boolean;
  onInvoiceCreated: () => Promise<void>;
}

type DevisFlowFilter = 'vente' | 'achat';

export function CommercialSourcesPanel({
  companyId,
  showPurchases,
  onInvoiceCreated,
}: CommercialSourcesPanelProps) {
  const [search, setSearch] = useState('');
  const [devisFlow, setDevisFlow] = useState<DevisFlowFilter>('vente');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [devisVente, setDevisVente] = useState<CommercialDevisRow[]>([]);
  const [devisAchat, setDevisAchat] = useState<CommercialDevisRow[]>([]);
  const [bcVente, setBcVente] = useState<CommercialDevisRow[]>([]);
  const [bcAchat, setBcAchat] = useState<CommercialDevisRow[]>([]);
  const [blClient, setBlClient] = useState<WarehouseDocumentRow[]>([]);
  const [blFournisseur, setBlFournisseur] = useState<WarehouseDocumentRow[]>([]);
  const [beDocs, setBeDocs] = useState<WarehouseDocumentRow[]>([]);
  const [bsDocs, setBsDocs] = useState<WarehouseDocumentRow[]>([]);
  const [clients, setClients] = useState<TierDirectoryRow[]>([]);
  const [fournisseurs, setFournisseurs] = useState<TierDirectoryRow[]>([]);
  const [magasinTypes, setMagasinTypes] = useState<MagasinDocFilter[]>(() =>
    defaultMagasinSelection(showPurchases)
  );
  const [selectedBlIds, setSelectedBlIds] = useState<Record<MagasinDocFilter, string[]>>({
    BL_CLIENT: [],
    BL_FOURNISSEUR: [],
    BE: [],
    BS: [],
  });

  useEffect(() => {
    setMagasinTypes((prev) => {
      const allowed = new Set(defaultMagasinSelection(showPurchases));
      const next = prev.filter((t) => allowed.has(t));
      return next.length > 0 ? next : [...allowed];
    });
  }, [showPurchases]);

  useEffect(() => {
    if (!showPurchases && devisFlow === 'achat') {
      setDevisFlow('vente');
    }
  }, [showPurchases, devisFlow]);

  const warehouseByType = useMemo(
    (): Record<MagasinDocFilter, WarehouseDocumentRow[]> => ({
      BL_CLIENT: blClient,
      BL_FOURNISSEUR: blFournisseur,
      BE: beDocs,
      BS: bsDocs,
    }),
    [blClient, blFournisseur, beDocs, bsDocs]
  );

  const visibleMagasinOptions = useMemo(
    () => MAGASIN_DOC_OPTIONS.filter((o) => showPurchases || !o.purchasesOnly),
    [showPurchases]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const tasks = [
      { key: 'devis vente', fn: () => fetchCommercialDevisList({ flow: 'vente', kind: 'devis' }) },
      { key: 'devis achat', fn: () => fetchCommercialDevisList({ flow: 'achat', kind: 'devis' }) },
      { key: 'BC vente', fn: () => fetchCommercialDevisList({ flow: 'vente', kind: 'bc' }) },
      { key: 'BC achat', fn: () => fetchCommercialDevisList({ flow: 'achat', kind: 'bc' }) },
      { key: 'BL client', fn: () => fetchWarehouseDocuments(['BL_CLIENT']) },
      { key: 'BL fournisseur', fn: () => fetchWarehouseDocuments(['BL_FOURNISSEUR']) },
      { key: 'BE', fn: () => fetchWarehouseDocuments(['BE']) },
      { key: 'BS', fn: () => fetchWarehouseDocuments(['BS']) },
      { key: 'clients', fn: () => fetchClientsDirectory(companyId) },
      { key: 'fournisseurs', fn: () => fetchFournisseursDirectory(companyId) },
    ] as const;

    const results = await Promise.allSettled(tasks.map((t) => t.fn()));
    const errors: string[] = [];

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        errors.push(`${tasks[i].key}: ${msg}`);
        console.error(`CommercialSources load failed (${tasks[i].key}):`, result.reason);
      }
    });

    const val = <T,>(idx: number, fallback: T): T =>
      results[idx].status === 'fulfilled' ? (results[idx] as PromiseFulfilledResult<T>).value : fallback;

    setDevisVente(val(0, []));
    setDevisAchat(val(1, []));
    setBcVente(val(2, []));
    setBcAchat(val(3, []));
    setBlClient(val(4, []));
    setBlFournisseur(val(5, []));
    setBeDocs(val(6, []));
    setBsDocs(val(7, []));
    setClients(val(8, []));
    setFournisseurs(val(9, []));

    if (errors.length === tasks.length) {
      toast.error(errors[0] ?? 'Impossible de charger les pièces commerciales');
    } else if (errors.length > 0) {
      toast.warning(`Certaines listes n'ont pas pu être chargées (${errors.length})`, {
        description: errors.slice(0, 2).join(' · '),
      });
    }

    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filterText = (text: string | null | undefined) => !q || String(text || '').toLowerCase().includes(q);

  const filterDevis = (rows: CommercialDevisRow[]) =>
    rows.filter((r) => filterText(r.numero) || filterText(r.thirdPartyName));

  const filterWarehouse = (rows: WarehouseDocumentRow[]) =>
    rows.filter((r) => filterText(r.numero) || filterText(r.thirdPartyName));

  const filterTiers = (rows: TierDirectoryRow[]) =>
    rows.filter((r) => filterText(r.nom) || filterText(r.matriculeFiscale));

  const handleDevisInvoice = async (row: CommercialDevisRow) => {
    setBusyId(`devis-${row.id}`);
    try {
      const numero = await createFinanceInvoiceFromDevis(companyId, row.id);
      toast.success(`Facture brouillon ${numero} créée depuis ${DEVIS_KIND_LABELS[row.kind]} ${row.numero}`);
      await onInvoiceCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Création impossible');
    } finally {
      setBusyId(null);
    }
  };

  const handleDocInvoice = async (row: WarehouseDocumentRow) => {
    setBusyId(`doc-${row.id}`);
    try {
      const numero = await createFinanceInvoiceFromDocument(companyId, row.id);
      toast.success(`Facture brouillon ${numero} créée depuis ${WAREHOUSE_DOC_LABELS[row.type]} ${row.numero}`);
      await onInvoiceCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Création impossible');
    } finally {
      setBusyId(null);
    }
  };

  const handleGroupedBlInvoice = async (docType: MagasinDocFilter) => {
    const ids = selectedBlIds[docType];
    if (ids.length < 2) {
      toast.error('Sélectionnez au moins 2 BL à regrouper.');
      return;
    }
    setBusyId(`group-${docType}`);
    try {
      const numero = await createFinanceInvoiceFromGroupedDocuments(companyId, ids);
      toast.success(`Facture groupée ${numero} créée (${ids.length} BL)`);
      setSelectedBlIds((prev) => ({ ...prev, [docType]: [] }));
      await onInvoiceCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Regroupement impossible');
    } finally {
      setBusyId(null);
    }
  };

  const toggleBlSelection = (docType: MagasinDocFilter, id: string, checked: boolean) => {
    setSelectedBlIds((prev) => {
      const current = prev[docType];
      const next = checked ? [...current, id] : current.filter((x) => x !== id);
      return { ...prev, [docType]: next };
    });
  };

  const stats = useMemo(
    () => ({
      devis: devisVente.length + devisAchat.length,
      bc: bcVente.length + bcAchat.length,
      magasin: magasinTypes.reduce((n, t) => n + warehouseByType[t].length, 0),
      tiers: clients.length + fournisseurs.length,
    }),
    [devisVente, devisAchat, bcVente, bcAchat, magasinTypes, warehouseByType, clients, fournisseurs]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-2 items-center">
          <Input
            className="max-w-sm"
            placeholder="Rechercher N°, tiers, MF…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" size="sm" className="gap-1" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <div className="flex flex-wrap gap-2 ml-auto text-xs">
            <Badge variant="secondary">{stats.devis} devis</Badge>
            <Badge variant="secondary">{stats.bc} BC</Badge>
            <Badge variant="secondary">{stats.magasin} pièces magasin</Badge>
            <Badge variant="secondary">{stats.tiers} tiers</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="devis" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="devis" className="gap-1">
            <FileText className="h-3.5 w-3.5" />
            Devis
          </TabsTrigger>
          <TabsTrigger value="bc" className="gap-1">
            <ShoppingCart className="h-3.5 w-3.5" />
            Bons de commande
          </TabsTrigger>
          <TabsTrigger value="magasin" className="gap-1">
            <Package className="h-3.5 w-3.5" />
            BL / BE / BS
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1">
            <Users className="h-3.5 w-3.5" />
            Clients
          </TabsTrigger>
          {showPurchases && (
            <TabsTrigger value="fournisseurs" className="gap-1">
              <Building2 className="h-3.5 w-3.5" />
              Fournisseurs
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="devis" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Type de devis</span>
            <ToggleGroup
              type="single"
              value={devisFlow}
              onValueChange={(v) => v && setDevisFlow(v as DevisFlowFilter)}
            >
              <ToggleGroupItem value="vente" aria-label="Devis vente">
                Ventes
              </ToggleGroupItem>
              {showPurchases && (
                <ToggleGroupItem value="achat" aria-label="Devis achat">
                  Achats
                </ToggleGroupItem>
              )}
            </ToggleGroup>
          </div>
          <DevisTable
            title={devisFlow === 'vente' ? 'Devis vente' : 'Devis achat'}
            subtitle={
              devisFlow === 'vente'
                ? 'Module Ventes — table devis'
                : 'Module Achats — table devis'
            }
            rows={filterDevis(devisFlow === 'vente' ? devisVente : devisAchat)}
            loading={loading}
            busyId={busyId}
            onGenerate={handleDevisInvoice}
          />
        </TabsContent>

        <TabsContent value="bc" className="mt-4 space-y-6">
          <DevisTable
            title="BC vente (bons de commande clients)"
            subtitle="is_bc = true, type vente"
            rows={filterDevis(bcVente)}
            loading={loading}
            busyId={busyId}
            onGenerate={handleDevisInvoice}
          />
          {showPurchases && (
            <DevisTable
              title="BC achat (bons de commande fournisseurs)"
              subtitle="is_bc = true, type achat"
              rows={filterDevis(bcAchat)}
              loading={loading}
              busyId={busyId}
              onGenerate={handleDevisInvoice}
            />
          )}
        </TabsContent>

        <TabsContent value="magasin" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Types de documents</CardTitle>
              <CardDescription>
                Choisissez les pièces magasin à afficher (BL, BE, BS). Plusieurs sélections possibles.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <ToggleGroup
                type="multiple"
                variant="outline"
                size="sm"
                className="flex flex-wrap justify-start"
                value={magasinTypes}
                onValueChange={(values) => {
                  if (values.length === 0) return;
                  setMagasinTypes(values as MagasinDocFilter[]);
                }}
              >
                {visibleMagasinOptions.map((opt) => (
                  <ToggleGroupItem key={opt.type} value={opt.type} className="gap-1.5">
                    {opt.type.startsWith('BL') ? (
                      <Truck className="h-3.5 w-3.5" />
                    ) : (
                      <Package className="h-3.5 w-3.5" />
                    )}
                    {opt.shortLabel}
                    {!loading && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                        {warehouseByType[opt.type].length}
                      </Badge>
                    )}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setMagasinTypes(defaultMagasinSelection(showPurchases))}
              >
                Tout afficher
              </Button>
            </CardContent>
          </Card>

          {magasinTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">
              Sélectionnez au moins un type de document ci-dessus.
            </p>
          ) : (
            <div className="space-y-6">
              {visibleMagasinOptions
                .filter((opt) => magasinTypes.includes(opt.type))
                .map((opt) => (
                  <WarehouseTable
                    key={opt.type}
                    title={opt.label}
                    icon={
                      opt.type.startsWith('BL') ? (
                        <Truck className="h-4 w-4" />
                      ) : (
                        <Package className="h-4 w-4" />
                      )
                    }
                    rows={filterWarehouse(warehouseByType[opt.type])}
                    loading={loading}
                    busyId={busyId}
                    onGenerate={handleDocInvoice}
                    allowMultiSelect={opt.type === 'BL_CLIENT' || opt.type === 'BL_FOURNISSEUR'}
                    selectedIds={selectedBlIds[opt.type]}
                    onToggleSelect={(id, checked) => toggleBlSelection(opt.type, id, checked)}
                    onGroupSelected={() => void handleGroupedBlInvoice(opt.type)}
                    groupBusy={busyId === `group-${opt.type}`}
                  />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <TiersTable title="Liste clients" rows={filterTiers(clients)} loading={loading} />
        </TabsContent>

        {showPurchases && (
          <TabsContent value="fournisseurs" className="mt-4">
            <TiersTable title="Liste fournisseurs" rows={filterTiers(fournisseurs)} loading={loading} isSupplier />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function DevisTable({
  title,
  subtitle,
  rows,
  loading,
  busyId,
  onGenerate,
}: {
  title: string;
  subtitle: string;
  rows: CommercialDevisRow[];
  loading: boolean;
  busyId: string | null;
  onGenerate: (row: CommercialDevisRow) => void;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows]);
  const paginated = useMemo(() => paginateList(rows, page), [rows, page]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune pièce.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead>MF</TableHead>
                  <TableHead>Lignes</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Action Finance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.slice.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.numero}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.thirdPartyName || '—'}</TableCell>
                    <TableCell className="text-xs">{row.thirdPartyTaxId || '—'}</TableCell>
                    <TableCell>{row.lineCount}</TableCell>
                    <TableCell className="tabular-nums">{formatMontantDt(row.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === `devis-${row.id}`}
                        onClick={() => onGenerate(row)}
                      >
                        {busyId === `devis-${row.id}` ? '…' : '→ Facture Finance'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <FinanceListPagination
            page={paginated.page}
            totalPages={paginated.totalPages}
            total={paginated.total}
            from={paginated.from}
            to={paginated.to}
            onPageChange={setPage}
          />
        )}
      </CardContent>
    </Card>
  );
}

function WarehouseTable({
  title,
  icon,
  rows,
  loading,
  busyId,
  onGenerate,
  allowMultiSelect,
  selectedIds = [],
  onToggleSelect,
  onGroupSelected,
  groupBusy,
}: {
  title: string;
  icon: React.ReactNode;
  rows: WarehouseDocumentRow[];
  loading: boolean;
  busyId: string | null;
  onGenerate: (row: WarehouseDocumentRow) => void;
  allowMultiSelect?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string, checked: boolean) => void;
  onGroupSelected?: () => void;
  groupBusy?: boolean;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows]);
  const paginated = useMemo(() => paginateList(rows, page), [rows, page]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {allowMultiSelect && selectedIds.length >= 2 && (
            <Button size="sm" variant="default" disabled={groupBusy} onClick={onGroupSelected}>
              {groupBusy ? '…' : `Regrouper ${selectedIds.length} BL → 1 facture`}
            </Button>
          )}
        </div>
        <CardDescription>
          Moteur documents v2 — {allowMultiSelect ? 'cochez plusieurs BL du même tiers pour les fusionner.' : 'table documents'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune pièce.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {allowMultiSelect && <TableHead className="w-10" />}
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead>Lignes</TableHead>
                  <TableHead>Total HT</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Action Finance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.slice.map((row) => (
                  <TableRow key={row.id}>
                    {allowMultiSelect && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(row.id)}
                          onCheckedChange={(c) => onToggleSelect?.(row.id, c === true)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono">{row.numero}</TableCell>
                    <TableCell>{row.createdAt.slice(0, 10)}</TableCell>
                    <TableCell>{row.thirdPartyName || '—'}</TableCell>
                    <TableCell>{row.lineCount}</TableCell>
                    <TableCell className="tabular-nums">{formatMontantDt(row.totalHt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === `doc-${row.id}`}
                        onClick={() => onGenerate(row)}
                      >
                        {busyId === `doc-${row.id}` ? '…' : '→ Facture Finance'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <FinanceListPagination
            page={paginated.page}
            totalPages={paginated.totalPages}
            total={paginated.total}
            from={paginated.from}
            to={paginated.to}
            onPageChange={setPage}
          />
        )}
      </CardContent>
    </Card>
  );
}

function TiersTable({
  title,
  rows,
  loading,
  isSupplier,
}: {
  title: string;
  rows: TierDirectoryRow[];
  loading: boolean;
  isSupplier?: boolean;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows]);
  const paginated = useMemo(() => paginateList(rows, page), [rows, page]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          Annuaire {isSupplier ? 'fournisseurs' : 'clients'} — utilisé pour les comptes PCG{' '}
          {isSupplier ? '401' : '411'} et les règlements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun tiers enregistré.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raison sociale</TableHead>
                  <TableHead>Matricule fiscal</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Téléphone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.slice.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.nom}</TableCell>
                    <TableCell className="text-xs font-mono">{row.matriculeFiscale || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.location || '—'}</TableCell>
                    <TableCell className="text-sm">{row.phone || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <FinanceListPagination
            page={paginated.page}
            totalPages={paginated.totalPages}
            total={paginated.total}
            from={paginated.from}
            to={paginated.to}
            onPageChange={setPage}
          />
        )}
      </CardContent>
    </Card>
  );
}
