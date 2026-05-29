import { useCallback, useEffect, useMemo, useState } from 'react';

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

import { Building2, Landmark } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useFinanceCompany } from '../context/FinanceCompanyContext';

import { listInvoiceLines, listInvoices, listPayments } from '../services/financeApi';

import type { InvoiceLineRow, InvoiceRow, PaymentRow } from '../types';

import {

  DEFAULT_SUBSECTION,

  getBillingSubsections,

  getFiscalSubsections,

  getSettlementsSubsections,

  getVisibleMainSections,

  type FinanceMainSectionId,

} from '../lib/financeNavigation';

import { FinanceSectionHeader, FinanceSubNav, FinanceSubsectionHint } from './layout/FinanceSubNav';

import { CommercialSourcesPanel } from './sources/CommercialSourcesPanel';

import { TreasuryHubPanel } from './treasury/TreasuryHubPanel';

import { AvoirFinancierPanel } from './avoirs/AvoirFinancierPanel';

import { VatDeclarationDashboard } from './vat/VatDeclarationDashboard';

import { FinanceSalesPanel } from './FinanceSalesPanel';

import { FinancePurchasesPanel } from './FinancePurchasesPanel';

import { AgedBalancePanel } from './receivables/AgedBalancePanel';

import { UnpaidDisputesPanel } from './collections/UnpaidDisputesPanel';

import { PaymentReglementsPanel } from './payments/PaymentReglementsPanel';

import { CertificatRetenuePanel } from './withholding/CertificatRetenuePanel';

import { AccountingStatementsPanel } from './statements/AccountingStatementsPanel';

import {

  fetchClientsForSettlement,

  fetchFournisseursForSettlement,

} from '../services/paymentApi';



export function FinanceDashboard() {

  const { company, capabilities, requestCompanyPicker, companies } = useFinanceCompany();

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineRow[]>([]);

  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [loading, setLoading] = useState(true);

  const [clientsOptions, setClientsOptions] = useState<Awaited<ReturnType<typeof fetchClientsForSettlement>>>([]);

  const [fournisseursOptions, setFournisseursOptions] = useState<

    Awaited<ReturnType<typeof fetchFournisseursForSettlement>>

  >([]);



  const [mainSection, setMainSection] = useState<FinanceMainSectionId>('overview');

  const [billingSub, setBillingSub] = useState(DEFAULT_SUBSECTION.billing);

  const [settlementsSub, setSettlementsSub] = useState(DEFAULT_SUBSECTION.settlements);

  const [fiscalSub, setFiscalSub] = useState(DEFAULT_SUBSECTION.fiscal);

  const mainSections = useMemo(() => getVisibleMainSections(capabilities), [capabilities]);

  const billingSubs = useMemo(() => getBillingSubsections(capabilities), [capabilities]);

  const settlementsSubs = useMemo(() => getSettlementsSubsections(capabilities), [capabilities]);

  const fiscalSubs = useMemo(() => getFiscalSubsections(capabilities), [capabilities]);

  const load = useCallback(async () => {

    if (!company) return;

    setLoading(true);

    try {

      const [inv, pay] = await Promise.all([listInvoices(company.id), listPayments(company.id)]);

      const lineRows = await listInvoiceLines(inv.map((x) => x.id));

      setInvoices(inv);

      setInvoiceLines(lineRows);

      setPayments(pay);

      const [clients, fournisseurs] = await Promise.all([

        fetchClientsForSettlement(),

        fetchFournisseursForSettlement(),

      ]);

      setClientsOptions(clients);

      setFournisseursOptions(fournisseurs);

    } catch (e: unknown) {

      console.error(e);

      toast.error('Impossible de charger les données Finance');

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

  const clientPaymentsTotal = clientPayments.reduce((s, p) => s + Number(p.amount), 0);



  const linesByInvoice = useMemo(

    () =>

      invoiceLines.reduce<Record<string, InvoiceLineRow[]>>((acc, line) => {

        if (!acc[line.invoice_id]) acc[line.invoice_id] = [];

        acc[line.invoice_id].push(line);

        return acc;

      }, {}),

    [invoiceLines]

  );



  const showPurchases = capabilities.purchases;

  const showSupplierPay = capabilities.supplierPayments;

  const activeMainMeta = mainSections.find((s) => s.id === mainSection);



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

              Comptabilité tunisienne — PCG, TVA, timbre fiscal, retenue à la source

            </p>

          </div>

        </div>

        {companies.length > 1 && (

          <Button variant="outline" onClick={requestCompanyPicker} className="gap-2 shrink-0">

            <Building2 className="h-4 w-4" />

            Changer de société

          </Button>

        )}

      </div>



      <Tabs

        value={mainSection}

        onValueChange={(v) => setMainSection(v as FinanceMainSectionId)}

        className="w-full"

      >

        <div className="rounded-lg border bg-card p-1 shadow-sm">

          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-0.5 bg-transparent p-0">

            {mainSections.map((section) => {

              const Icon = section.icon;

              return (

                <TabsTrigger

                  key={section.id}

                  value={section.id}

                  className={cn(

                    'gap-1.5 h-auto min-h-10 px-3 py-2 text-sm rounded-md',

                    'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',

                    'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/60'

                  )}

                >

                  <Icon className="h-4 w-4 shrink-0" />

                  <span className="hidden sm:inline">{section.label}</span>

                  <span className="sm:hidden">{section.label.split(' ')[0]}</span>

                </TabsTrigger>

              );

            })}

          </TabsList>

        </div>



        {activeMainMeta && mainSection !== 'overview' && (

          <p className="text-xs text-muted-foreground mt-3 px-1">{activeMainMeta.description}</p>

        )}



        {/* ——— Résumé ——— */}

        <TabsContent value="overview" className="mt-5 space-y-4">

          <FinanceSectionHeader

            title="Tableau de bord"

            description="Indicateurs clés et rappel du cadre fiscal tunisien"

          />

          <div className="grid gap-4 md:grid-cols-3">

            <Card>

              <CardHeader className="pb-2">

                <CardTitle className="text-sm font-medium">Factures vente</CardTitle>

                <CardDescription>Comptabilisées dans Finance</CardDescription>

              </CardHeader>

              <CardContent className="text-2xl font-bold tabular-nums">{saleInvoices.length}</CardContent>

            </Card>

            {showPurchases && (

              <Card>

                <CardHeader className="pb-2">

                  <CardTitle className="text-sm font-medium">Factures achat</CardTitle>

                  <CardDescription>Fournisseurs — Grosafe</CardDescription>

                </CardHeader>

                <CardContent className="text-2xl font-bold tabular-nums">{purchaseInvoices.length}</CardContent>

              </Card>

            )}

            <Card>

              <CardHeader className="pb-2">

                <CardTitle className="text-sm font-medium">Règlements</CardTitle>

                <CardDescription>Encaissements et décaissements</CardDescription>

              </CardHeader>

              <CardContent className="text-2xl font-bold tabular-nums">{payments.length}</CardContent>

            </Card>

          </div>

          <div className="grid gap-3 md:grid-cols-2">

            <Card>

              <CardHeader className="pb-2">

                <CardTitle className="text-sm">Cadre fiscal Tunisie</CardTitle>

              </CardHeader>

              <CardContent className="text-muted-foreground space-y-1.5 text-xs">

                <p>TVA légale : 19 %, 13 %, 7 %, 0 % — déclaration mensuelle.</p>

                <p>Timbre fiscal forfaitaire : 1,000 DT sur factures vente.</p>

                <p>Retenue à la source fournisseurs : seuil 1 000 DT TTC.</p>

                {showPurchases && <p>FODEC achats industriels : 1 % sur HT.</p>}

              </CardContent>

            </Card>

            <Card>

              <CardHeader className="pb-2">

                <CardTitle className="text-sm">Modules connectés</CardTitle>

              </CardHeader>

              <CardContent className="text-muted-foreground space-y-1.5 text-xs">

                <p>Devis &amp; BC — Ventes / Achats</p>

                <p>BL, BE, BS — Magasin v2</p>

                <p>Clients (411) &amp; fournisseurs (401)</p>

              </CardContent>

            </Card>

          </div>

        </TabsContent>



        {/* ——— Documents sources ——— */}

        <TabsContent value="sources" className="mt-5">

          <CommercialSourcesPanel

            companyId={company.id}

            showPurchases={showPurchases}

            onInvoiceCreated={load}

          />

        </TabsContent>



        {/* ——— Facturation ——— */}

        <TabsContent value="billing" className="mt-5 space-y-4">

          <FinanceSectionHeader

            title="Facturation"

            description="Factures comptables vente et achat, conformes au PCG tunisien"

          />

          <FinanceSubNav items={billingSubs} value={billingSub} onValueChange={setBillingSub} />

          <FinanceSubsectionHint items={billingSubs} activeId={billingSub} />



          {billingSub === 'sales' && (

            <FinanceSalesPanel

              companyId={company.id}

              invoices={saleInvoices}

              linesByInvoice={linesByInvoice}

              clients={clientsOptions}

              onReload={load}

            />

          )}

          {billingSub === 'purchases' && showPurchases && (

            <FinancePurchasesPanel

              companyId={company.id}

              invoices={purchaseInvoices}

              linesByInvoice={linesByInvoice}

              fournisseurs={fournisseursOptions}

              onReload={load}

            />

          )}

          {billingSub === 'avoirs' && (

            <AvoirFinancierPanel

              companyId={company.id}

              clients={clientsOptions}

              fournisseurs={fournisseursOptions}

              onCreated={load}

            />

          )}

        </TabsContent>



        {/* ——— Règlements & créances ——— */}

        <TabsContent value="settlements" className="mt-5 space-y-4">

          <FinanceSectionHeader

            title="Règlements & créances"

            description="Encaissements, paiements fournisseurs et suivi des encours tiers"

          />

          <FinanceSubNav items={settlementsSubs} value={settlementsSub} onValueChange={setSettlementsSub} />

          <FinanceSubsectionHint items={settlementsSubs} activeId={settlementsSub} />



          {settlementsSub === 'client-settlement' && (

            <PaymentReglementsPanel

              companyId={company.id}

              showClient

              showSupplier={false}

              mode="client"

              onReload={load}

            />

          )}

          {settlementsSub === 'supplier-settlement' && showSupplierPay && (

            <PaymentReglementsPanel

              companyId={company.id}

              showClient={false}

              showSupplier

              mode="fournisseur"

              onReload={load}

            />

          )}

          {settlementsSub === 'history-clients' && (

            <FinanceTable

              title="Historique — encaissements clients"

              loading={loading}

              empty="Aucun encaissement enregistré."

              rows={clientPayments}

              columns={[

                { key: 'payment_date', label: 'Date' },

                { key: 'counterparty_name', label: 'Client' },

                { key: 'amount', label: 'Montant', format: 'money' },

                { key: 'method', label: 'Mode' },

                { key: 'reference', label: 'Référence' },

              ]}

            />

          )}

          {settlementsSub === 'history-suppliers' && showSupplierPay && (

            <FinanceTable

              title="Historique — décaissements fournisseurs"

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

          {settlementsSub === 'aged-balance' && (

            <AgedBalancePanel saleInvoices={saleInvoices} purchaseInvoices={purchaseInvoices} />

          )}

          {settlementsSub === 'disputes' && <UnpaidDisputesPanel invoices={invoices} />}

        </TabsContent>



        {/* ——— Trésorerie ——— */}

        <TabsContent value="treasury" className="mt-5">

          <TreasuryHubPanel companyId={company.id} clientPaymentsTotal={clientPaymentsTotal} />

        </TabsContent>



        {/* ——— Fiscalité ——— */}

        {capabilities.vatDeclarations && (

          <TabsContent value="fiscal" className="mt-5 space-y-4">

            <FinanceSectionHeader

              title="Fiscalité"

              description="Obligations fiscales tunisiennes — TVA et retenue à la source"

            />

            <FinanceSubNav items={fiscalSubs} value={fiscalSub} onValueChange={setFiscalSub} />

            <FinanceSubsectionHint items={fiscalSubs} activeId={fiscalSub} />



            {fiscalSub === 'vat' && <VatDeclarationDashboard companyId={company.id} />}

            {fiscalSub === 'withholding' && capabilities.supplierWithholding && (

              <CertificatRetenuePanel

                clients={clientsOptions}

                fournisseurs={fournisseursOptions}

                sampleInvoices={purchaseInvoices.slice(0, 3).map((inv) => ({

                  numero: inv.numero,

                  montantTtc: Number(inv.total_ttc),

                }))}

              />

            )}

          </TabsContent>

        )}



        {/* ——— Comptabilité ——— */}

        {capabilities.statements && (

          <TabsContent value="accounting" className="mt-5 space-y-4">

            <FinanceSectionHeader
              title="Comptabilité"
              description="Journal, grand livre et balance"
            />

            <AccountingStatementsPanel companyId={company.id} />

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

    if (format === 'money')

      return `${Number(v).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;

    return String(v);

  };



  return (

    <Card>

      <CardHeader>

        <CardTitle className="text-lg">{title}</CardTitle>

      </CardHeader>

      <CardContent>

        {loading ? (

          <p className="text-sm text-muted-foreground">Chargement…</p>

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


