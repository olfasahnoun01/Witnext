import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useFinanceCompany } from '../context/FinanceCompanyContext';
import { listInvoices, listPayments } from '../services/financeApi';
import type { InvoiceRow, PaymentRow } from '../types';
import { ArrowLeftRight, Building2, FileSpreadsheet, Landmark, Receipt, Scale } from 'lucide-react';

export function FinanceDashboard() {
  const { company, capabilities, requestCompanyPicker, companies } = useFinanceCompany();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [inv, pay] = await Promise.all([listInvoices(company.id), listPayments(company.id)]);
      setInvoices(inv);
      setPayments(pay);
    } catch (e: unknown) {
      console.error(e);
      toast.error('Impossible de charger les donnees Finance');
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!company) return null;

  const saleInvoices = invoices.filter((i) => i.invoice_type === 'vente');
  const purchaseInvoices = invoices.filter((i) => i.invoice_type === 'achat');
  const clientPayments = payments.filter((p) => p.direction === 'inbound_client');
  const supplierPayments = payments.filter((p) => p.direction === 'outbound_supplier');

  const showPurchases = capabilities.purchases;
  const showSupplierPay = capabilities.supplierPayments;
  const showVatBlock = capabilities.vatDeclarations;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <Badge variant="secondary" className="font-mono uppercase">
                {company.code}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Operations filtrees par <code className="text-xs">company_id</code>. Les modules Ventes /
              Achats existants ne sont pas modifies.
            </p>
          </div>
        </div>
        {companies.length > 1 && (
          <Button variant="outline" onClick={requestCompanyPicker} className="gap-2 shrink-0">
            <Building2 className="h-4 w-4" />
            Changer de societe
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Resume</TabsTrigger>
          <TabsTrigger value="sales" className="gap-1">
            <Receipt className="h-3.5 w-3.5" />
            Factures vente
          </TabsTrigger>
          {showPurchases && (
            <TabsTrigger value="purchases" className="gap-1">
              <Receipt className="h-3.5 w-3.5" />
              Factures achat
            </TabsTrigger>
          )}
          <TabsTrigger value="payments" className="gap-1">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Reglements
          </TabsTrigger>
          <TabsTrigger value="treasury" className="gap-1">
            <Landmark className="h-3.5 w-3.5" />
            Tresorerie
          </TabsTrigger>
          {showVatBlock && (
            <TabsTrigger value="tax" className="gap-1">
              <Scale className="h-3.5 w-3.5" />
              TVA / retenues
            </TabsTrigger>
          )}
          {capabilities.statements && (
            <TabsTrigger value="statements" className="gap-1">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Etats
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Factures vente</CardTitle>
                <CardDescription>Module Finance</CardDescription>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{saleInvoices.length}</CardContent>
            </Card>
            {showPurchases && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Factures achat</CardTitle>
                  <CardDescription>Grosafe uniquement</CardDescription>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{purchaseInvoices.length}</CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Paiements enregistres</CardTitle>
                <CardDescription>Clients + eventuels fournisseurs</CardDescription>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{payments.length}</CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Les ecritures comptables (<code>journal_entries</code>), declarations fiscales (
            <code>tax_declarations</code>) et mouvements de tresorerie (<code>treasury_movements</code>) sont
            disponibles en base ; les ecrans de saisie pourront etre branches sur ces tables sans toucher aux
            modules historiques.
          </p>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <FinanceTable
            title="Factures clients (Finance)"
            loading={loading}
            empty="Aucune facture Finance. Creez des lignes dans public.invoices (company_id)."
            rows={saleInvoices}
            columns={[
              { key: 'numero', label: 'Numero' },
              { key: 'counterpart_name', label: 'Tiers' },
              { key: 'issue_date', label: 'Date' },
              { key: 'total_ttc', label: 'TTC', format: 'money' },
              { key: 'amount_paid', label: 'Paye', format: 'money' },
              { key: 'status', label: 'Statut' },
            ]}
          />
        </TabsContent>

        {showPurchases && (
          <TabsContent value="purchases" className="mt-4">
            <FinanceTable
              title="Factures fournisseurs (Finance)"
              loading={loading}
              empty="Aucune facture achat."
              rows={purchaseInvoices}
              columns={[
                { key: 'numero', label: 'Numero' },
                { key: 'counterpart_name', label: 'Fournisseur' },
                { key: 'issue_date', label: 'Date' },
                { key: 'total_ttc', label: 'TTC', format: 'money' },
                { key: 'status', label: 'Statut' },
              ]}
            />
          </TabsContent>
        )}

        <TabsContent value="payments" className="mt-4 space-y-6">
          <FinanceTable
            title="Encaissements clients"
            loading={loading}
            empty="Aucun encaissement."
            rows={clientPayments}
            columns={[
              { key: 'payment_date', label: 'Date' },
              { key: 'counterparty_name', label: 'Client' },
              { key: 'amount', label: 'Montant', format: 'money' },
              { key: 'method', label: 'Mode' },
              { key: 'reference', label: 'Reference' },
            ]}
          />
          {showSupplierPay && (
            <FinanceTable
              title="Decaissements fournisseurs"
              loading={loading}
              empty="Aucun paiement fournisseur."
              rows={supplierPayments}
              columns={[
                { key: 'payment_date', label: 'Date' },
                { key: 'counterparty_name', label: 'Fournisseur' },
                { key: 'amount', label: 'Montant', format: 'money' },
                { key: 'method', label: 'Mode' },
              ]}
            />
          )}
          {!showSupplierPay && (
            <p className="text-sm text-muted-foreground">
              Les paiements fournisseurs ne sont pas proposes pour cette societe.
            </p>
          )}
        </TabsContent>

        <TabsContent value="treasury" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tresorerie</CardTitle>
              <CardDescription>
                Table <code className="text-xs">treasury_movements</code> — saisie des flux a brancher ici (
                company_id obligatoire).
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Resume des encaissements clients :{' '}
              <strong>
                {clientPayments.reduce((s, p) => s + Number(p.amount), 0).toFixed(3)} TND
              </strong>{' '}
              (sur paiements charges).
            </CardContent>
          </Card>
        </TabsContent>

        {showVatBlock && (
          <TabsContent value="tax" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>TVA & declarations</CardTitle>
                <CardDescription>
                  Table <code className="text-xs">tax_declarations</code> (periode, TVA collectee / deductible,
                  retenue fournisseur si applicable).
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {capabilities.supplierWithholding
                  ? 'Grosafe : retenue a la source fournisseur disponible sur les lignes de declaration.'
                  : 'Granisafe / Safe-Team : pas de retenue a la source fournisseur dans ce module.'}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {capabilities.statements && (
          <TabsContent value="statements" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Etats financiers</CardTitle>
                <CardDescription>
                  Agrégations par societe (grand livre via <code className="text-xs">journal_entries</code> /{' '}
                  <code className="text-xs">journal_lines</code>).
                </CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function FinanceTable({
  title,
  loading,
  empty,
  rows,
  columns,
}: {
  title: string;
  loading: boolean;
  empty: string;
  rows: Record<string, unknown>[];
  columns: { key: string; label: string; format?: 'money' }[];
}) {
  const fmt = (v: unknown, format?: string) => {
    if (v == null || v === '') return '—';
    if (format === 'money') return `${Number(v).toFixed(3)} TND`;
    return String(v);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={String(row.id)}>
                    {columns.map((c) => (
                      <TableCell key={c.key} className="text-sm">
                        {fmt(row[c.key], c.format)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
