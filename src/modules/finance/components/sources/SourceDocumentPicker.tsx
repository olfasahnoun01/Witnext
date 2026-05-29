import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileInput } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatMontantDt } from '../../lib/money';
import {
  buildDraftFromDevis,
  buildDraftFromWarehouseDocument,
  fetchCommercialDevisList,
  fetchWarehouseDocuments,
} from '../../services/commercialBridgeApi';
import type { CommercialInvoiceDraft } from '../../types/commercialBridge';
import { DEVIS_KIND_LABELS, WAREHOUSE_DOC_LABELS } from '../../types/commercialBridge';

interface SourceDocumentPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: 'vente' | 'achat';
  onApply: (draft: CommercialInvoiceDraft) => void;
}

/** Sélecteur rapide de pièce commerciale pour pré-remplir une facture Finance. */
export function SourceDocumentPicker({ open, onOpenChange, direction, onApply }: SourceDocumentPickerProps) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [devisRows, setDevisRows] = useState<Awaited<ReturnType<typeof fetchCommercialDevisList>>>([]);
  const [bcRows, setBcRows] = useState<Awaited<ReturnType<typeof fetchCommercialDevisList>>>([]);
  const [warehouseRows, setWarehouseRows] = useState<Awaited<ReturnType<typeof fetchWarehouseDocuments>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const flow = direction;
      const whTypes =
        direction === 'vente'
          ? (['BL_CLIENT', 'BC_CLIENT', 'BS'] as const)
          : (['BL_FOURNISSEUR', 'BC_FOURNISSEUR', 'BE'] as const);

      const [devis, bc, wh] = await Promise.all([
        fetchCommercialDevisList({ flow, kind: 'devis' }),
        fetchCommercialDevisList({ flow, kind: 'bc' }),
        fetchWarehouseDocuments([...whTypes]),
      ]);
      setDevisRows(devis);
      setBcRows(bc);
      setWarehouseRows(wh);
    } catch (e) {
      toast.error('Impossible de charger les pièces sources');
    } finally {
      setLoading(false);
    }
  }, [direction]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const q = search.trim().toLowerCase();
  const match = (numero: string, tiers: string | null) =>
    !q || numero.toLowerCase().includes(q) || String(tiers || '').toLowerCase().includes(q);

  const filteredDevis = useMemo(() => devisRows.filter((r) => match(r.numero, r.thirdPartyName)), [devisRows, q]);
  const filteredBc = useMemo(() => bcRows.filter((r) => match(r.numero, r.thirdPartyName)), [bcRows, q]);
  const filteredWh = useMemo(
    () => warehouseRows.filter((r) => match(r.numero, r.thirdPartyName)),
    [warehouseRows, q]
  );

  const pickDevis = async (id: number) => {
    try {
      const draft = await buildDraftFromDevis(id);
      onApply(draft);
      onOpenChange(false);
      toast.success(`Formulaire pré-rempli depuis ${draft.source_ref.source_numero}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import impossible');
    }
  };

  const pickDoc = async (id: string) => {
    try {
      const draft = await buildDraftFromWarehouseDocument(id);
      onApply(draft);
      onOpenChange(false);
      toast.success(`Formulaire pré-rempli depuis ${draft.source_ref.source_numero}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import impossible');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileInput className="h-5 w-5" />
            Importer une pièce commerciale
          </DialogTitle>
          <DialogDescription>
            {direction === 'vente'
              ? 'Devis, BC ou BL client — les lignes et le tiers seront repris dans la facture vente.'
              : 'Devis, BC ou BL/BE fournisseur — reprise pour facture achat (FODEC paramétrable par ligne).'}
          </DialogDescription>
        </DialogHeader>

        <Input placeholder="Filtrer par N° ou tiers…" value={search} onChange={(e) => setSearch(e.target.value)} />

        <Tabs defaultValue="devis">
          <TabsList>
            <TabsTrigger value="devis">Devis</TabsTrigger>
            <TabsTrigger value="bc">BC</TabsTrigger>
            <TabsTrigger value="magasin">BL / BE / BS</TabsTrigger>
          </TabsList>

          <TabsContent value="devis" className="mt-3">
            <SourceTable
              loading={loading}
              empty="Aucun devis."
              rows={filteredDevis.map((r) => ({
                key: String(r.id),
                numero: r.numero,
                date: r.date,
                tiers: r.thirdPartyName,
                montant: r.totalAmount,
                badge: DEVIS_KIND_LABELS[r.kind],
                onPick: () => void pickDevis(r.id),
              }))}
            />
          </TabsContent>

          <TabsContent value="bc" className="mt-3">
            <SourceTable
              loading={loading}
              empty="Aucun bon de commande."
              rows={filteredBc.map((r) => ({
                key: String(r.id),
                numero: r.numero,
                date: r.date,
                tiers: r.thirdPartyName,
                montant: r.totalAmount,
                badge: 'BC',
                onPick: () => void pickDevis(r.id),
              }))}
            />
          </TabsContent>

          <TabsContent value="magasin" className="mt-3">
            <SourceTable
              loading={loading}
              empty="Aucune pièce magasin."
              rows={filteredWh.map((r) => ({
                key: r.id,
                numero: r.numero,
                date: r.createdAt.slice(0, 10),
                tiers: r.thirdPartyName,
                montant: r.totalHt,
                badge: WAREHOUSE_DOC_LABELS[r.type],
                onPick: () => void pickDoc(r.id),
              }))}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceTable({
  loading,
  empty,
  rows,
}: {
  loading: boolean;
  empty: string;
  rows: Array<{
    key: string;
    numero: string;
    date: string;
    tiers: string | null;
    montant: number;
    badge: string;
    onPick: () => void;
  }>;
}) {
  if (loading) return <p className="text-sm text-muted-foreground py-4">Chargement…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-4">{empty}</p>;

  return (
    <div className="rounded-md border overflow-x-auto max-h-[320px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N°</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Tiers</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Type</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell className="font-mono">{r.numero}</TableCell>
              <TableCell>{r.date}</TableCell>
              <TableCell>{r.tiers || '—'}</TableCell>
              <TableCell className="tabular-nums">{formatMontantDt(r.montant)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {r.badge}
                </Badge>
              </TableCell>
              <TableCell>
                <Button size="sm" variant="secondary" onClick={r.onPick}>
                  Importer
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
