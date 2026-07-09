import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, BarChart3, Package, Users, Building2 } from 'lucide-react';
import { useAppCompany, useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { useSessionResumeReload } from '@/hooks/useSessionResumeReload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportExportActions } from '@/components/reporting/ReportExportActions';
import type { ReportExportPayload } from '@/lib/reportExport';
import {
  buildPeriodRanges,
  computeClientLedger,
  computeProductSales,
  computeRevenueByPeriod,
  computeSupplierLedger,
  loadReportingData,
  type ReportPeriod,
} from '@/services/reportingService';
import type { InvoiceRow } from '@/modules/finance/types';

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  semiannual: 'Semestriel',
  annual: 'Annuel',
};

function formatTnd(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function CardHeaderWithExport({
  title,
  description,
  exportPayload,
}: {
  title: string;
  description?: string;
  exportPayload: ReportExportPayload;
}) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
      <div>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription className="mt-1.5">{description}</CardDescription>}
      </div>
      <ReportExportActions payload={exportPayload} />
    </CardHeader>
  );
}

export function ReportingModule() {
  const { currentCompanyId, loading: companyLoading } = useAppCompany();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [lines, setLines] = useState<Awaited<ReturnType<typeof loadReportingData>>['lines']>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    try {
      const data = await loadReportingData(currentCompanyId);
      setInvoices(data.invoices);
      setLines(data.lines);
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId]);

  useEffect(() => {
    if (!companyLoading && currentCompanyId) void load();
  }, [companyLoading, currentCompanyId, load]);

  useSessionResumeReload(load);
  useCompanyChangeReload(load);

  const ranges = useMemo(() => buildPeriodRanges(period, year), [period, year]);
  const revenueRows = useMemo(
    () => computeRevenueByPeriod(invoices, ranges),
    [invoices, ranges]
  );
  const productRows = useMemo(
    () => computeProductSales(invoices, lines, ranges[ranges.length - 1]),
    [invoices, lines, ranges]
  );
  const clientLedger = useMemo(() => computeClientLedger(invoices), [invoices]);
  const supplierLedger = useMemo(() => computeSupplierLedger(invoices), [invoices]);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2];
  }, []);

  const periodSubtitle = `${PERIOD_LABELS[period]} — ${year}`;
  const fileSuffix = `${period}-${year}`;

  const caExport: ReportExportPayload = useMemo(
    () => ({
      title: `Chiffre d'affaires — ${periodSubtitle}`,
      subtitle: 'Factures vente comptabilisées (hors brouillon / annulées)',
      filenameBase: `rapport-ca-${fileSuffix}`,
      headers: ['Période', 'CA HT', 'CA TTC', 'Factures'],
      rows: revenueRows.map((r) => [r.label, formatTnd(r.caHt), formatTnd(r.caTtc), r.invoiceCount]),
    }),
    [revenueRows, periodSubtitle, fileSuffix]
  );

  const productsExport: ReportExportPayload = useMemo(
    () => ({
      title: `Ventes par produit — ${periodSubtitle}`,
      subtitle: `Période : ${ranges[ranges.length - 1]?.label ?? ''}`,
      filenameBase: `rapport-produits-${fileSuffix}`,
      headers: ['Code', 'Description', 'Quantité', 'CA HT', 'CA TTC'],
      rows: productRows.map((r) => [
        r.productCode,
        r.description,
        r.quantity,
        formatTnd(r.caHt),
        formatTnd(r.caTtc),
      ]),
    }),
    [productRows, ranges, periodSubtitle, fileSuffix]
  );

  const clientsExport: ReportExportPayload = useMemo(
    () => ({
      title: 'Portefeuille clients',
      subtitle: 'Total ventes et reste à encaisser par client',
      filenameBase: `rapport-clients-${fileSuffix}`,
      headers: ['Client', 'Total TTC', 'Encaissé', 'Reste à payer', 'Factures'],
      rows: clientLedger.map((r) => [
        r.name,
        formatTnd(r.totalTtc),
        formatTnd(r.paid),
        formatTnd(r.balance),
        r.invoiceCount,
      ]),
    }),
    [clientLedger, fileSuffix]
  );

  const suppliersExport: ReportExportPayload = useMemo(
    () => ({
      title: 'Comptabilité fournisseurs',
      subtitle: 'Soldes restants à payer par fournisseur',
      filenameBase: `rapport-fournisseurs-${fileSuffix}`,
      headers: ['Fournisseur', 'Total TTC', 'Payé', 'Reste à payer', 'Factures'],
      rows: supplierLedger.map((r) => [
        r.name,
        formatTnd(r.totalTtc),
        formatTnd(r.paid),
        formatTnd(r.balance),
        r.invoiceCount,
      ]),
    }),
    [supplierLedger, fileSuffix]
  );

  if (companyLoading || loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Chargement des rapports…
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Reporting & analyses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chiffre d&apos;affaires, ventes par produit, portefeuille clients et comptabilité fournisseurs.
          Exportez chaque rapport en Excel, CSV, PDF ou imprimez-le.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as ReportPeriod[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="ca" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="ca" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Chiffre d&apos;affaires
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5">
            <Package className="h-4 w-4" /> Ventes par produit
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5">
            <Users className="h-4 w-4" /> Portefeuille clients
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Comptabilité fournisseurs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ca">
          <Card>
            <CardHeaderWithExport
              title={`Chiffre d'affaires — ${PERIOD_LABELS[period]}`}
              description="Factures vente comptabilisées (hors brouillon / annulées)"
              exportPayload={caExport}
            />
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-right">CA HT</TableHead>
                    <TableHead className="text-right">CA TTC</TableHead>
                    <TableHead className="text-right">Factures</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueRows.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right">{formatTnd(row.caHt)}</TableCell>
                      <TableCell className="text-right">{formatTnd(row.caTtc)}</TableCell>
                      <TableCell className="text-right">{row.invoiceCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeaderWithExport
              title="Performance ventes par produit"
              description={`Agrégation des lignes de facture — période ${ranges[ranges.length - 1]?.label}`}
              exportPayload={productsExport}
            />
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">CA HT</TableHead>
                    <TableHead className="text-right">CA TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Aucune vente sur la période
                      </TableCell>
                    </TableRow>
                  ) : (
                    productRows.map((row) => (
                      <TableRow key={`${row.productCode}-${row.description}`}>
                        <TableCell className="font-mono text-xs">{row.productCode}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-right">{formatTnd(row.caHt)}</TableCell>
                        <TableCell className="text-right">{formatTnd(row.caTtc)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeaderWithExport
              title="Portefeuille clients"
              description="Total ventes et reste à encaisser par client"
              exportPayload={clientsExport}
            />
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                    <TableHead className="text-right">Encaissé</TableHead>
                    <TableHead className="text-right">Reste à payer</TableHead>
                    <TableHead className="text-right">Factures</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientLedger.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{formatTnd(row.totalTtc)}</TableCell>
                      <TableCell className="text-right">{formatTnd(row.paid)}</TableCell>
                      <TableCell className="text-right font-semibold text-warning">
                        {formatTnd(row.balance)}
                      </TableCell>
                      <TableCell className="text-right">{row.invoiceCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeaderWithExport
              title="Comptabilité fournisseurs"
              description="Soldes restants à payer par fournisseur"
              exportPayload={suppliersExport}
            />
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                    <TableHead className="text-right">Payé</TableHead>
                    <TableHead className="text-right">Reste à payer</TableHead>
                    <TableHead className="text-right">Factures</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierLedger.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{formatTnd(row.totalTtc)}</TableCell>
                      <TableCell className="text-right">{formatTnd(row.paid)}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        {formatTnd(row.balance)}
                      </TableCell>
                      <TableCell className="text-right">{row.invoiceCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
