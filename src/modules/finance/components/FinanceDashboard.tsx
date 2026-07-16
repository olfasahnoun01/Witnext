import { useCallback, useEffect, useMemo, useState } from 'react';

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

import { Building2 } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useFinanceCompany } from '../context/FinanceCompanyContext';

import { listInvoiceLines, listInvoices, listPayments } from '../services/financeApi';

import type { InvoiceLineRow, InvoiceRow, PaymentRow } from '../types';

import {

  DEFAULT_SUBSECTION,

  getBillingSubsections,

  getFiscalSubsections,

  getSettlementsSubsections,

  getSourcesSubsections,

  getVisibleMainSections,

  FINANCE_MAIN_SECTIONS,

  type FinanceMainSectionId,

} from '../lib/financeNavigation';

import { FinanceSubNav, FinanceWorkArea } from './layout/FinanceSubNav';
import { FINANCE_EXCEL_TABLE_CLASS } from '../lib/financeStyles';
import { getFinanceSectionTheme } from '../lib/financeSectionThemes';

import { CommercialSourcesPanel } from './sources/CommercialSourcesPanel';
import { FinanceCompanyLogo } from './FinanceCompanyLogo';

import { TreasuryHubPanel } from './treasury/TreasuryHubPanel';

import { AvoirsHubPanel } from './avoirs/AvoirsHubPanel';

import { PaymentHistoryPanel } from './payments/PaymentHistoryPanel';

import { VatDeclarationDashboard } from './vat/VatDeclarationDashboard';

import { FinanceSalesPanel } from './FinanceSalesPanel';

import { FinancePurchasesPanel } from './FinancePurchasesPanel';

import { AgedBalancePanel } from './receivables/AgedBalancePanel';

import { UnpaidDisputesPanel } from './collections/UnpaidDisputesPanel';

import { PaymentReglementsPanel } from './payments/PaymentReglementsPanel';

import { CertificatRetenuePanel } from './withholding/CertificatRetenuePanel';

import { AccountingStatementsPanel } from './statements/AccountingStatementsPanel';

import { FinanceOverviewCharts } from './overview/FinanceOverviewCharts';

import { PayrollSlipsPanel } from './payroll/PayrollSlipsPanel';

import { CnssDeclarationPanel } from './payroll/CnssDeclarationPanel';

import { sumPurchasesTtc, sumSalesTtc } from '../lib/financeOverviewStats';

import { FinanceAmount } from './shared/FinanceAmount';

import {

  fetchClientsForSettlement,

  fetchFournisseursForSettlement,

} from '../services/paymentApi';



export function FinanceDashboard() {

  const { company, capabilities, requestCompanyPicker, companies, canSwitchCompany } = useFinanceCompany();

  const [tejCompanyPatch, setTejCompanyPatch] = useState<{
    matricule_fiscal: string;
    categorie_contribuable: 'PM' | 'PP';
  } | null>(null);

  const companyForTej = useMemo(() => {
    if (!company) return null;
    if (!tejCompanyPatch) return company;
    return { ...company, ...tejCompanyPatch };
  }, [company, tejCompanyPatch]);

  useEffect(() => {
    setTejCompanyPatch(null);
  }, [company?.id]);

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

  const [sourcesSub, setSourcesSub] = useState(DEFAULT_SUBSECTION.sources);

  const mainSections = useMemo(() => getVisibleMainSections(capabilities), [capabilities]);

  const billingSubs = useMemo(() => getBillingSubsections(capabilities), [capabilities]);

  const settlementsSubs = useMemo(() => getSettlementsSubsections(capabilities), [capabilities]);

  const fiscalSubs = useMemo(() => getFiscalSubsections(capabilities), [capabilities]);

  const sourcesSubs = useMemo(() => getSourcesSubsections(), []);

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

        fetchClientsForSettlement(company.id),

        fetchFournisseursForSettlement(company.id),

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

  const salesTtcTotal = sumSalesTtc(saleInvoices);

  const purchasesTtcTotal = sumPurchasesTtc(purchaseInvoices);



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



  return (

    <div className={cn('space-y-6', FINANCE_EXCEL_TABLE_CLASS)}>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-start gap-3">

          <FinanceCompanyLogo
            code={company.code}
            companyName={company.name}
            logoUrl={company.logo_url}
            className="h-14 w-14 p-1.5"
            imageClassName="h-full max-h-10"
          />

          <div>

            <h1 className="text-2xl font-bold">{company.name}</h1>

          </div>

        </div>

        {canSwitchCompany && companies.length > 1 && (

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

        <div className="rounded-lg border-2 border-amber-500/20 bg-card p-1.5 shadow-sm">

          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/30 p-1 border-b border-border/50">

            {mainSections.map((section) => {

              const Icon = section.icon;

              const theme = getFinanceSectionTheme(section.id);

              return (

                <TabsTrigger

                  key={section.id}

                  value={section.id}

                  className={cn(

                    'gap-1.5 h-auto min-h-10 px-3 py-2 text-sm rounded-md border transition-colors',

                    theme.mainTabInactive,

                    theme.mainTabActive

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



        {/* ——— Résumé ——— */}

        <TabsContent value="overview" className="mt-5 space-y-4">
          <FinanceWorkArea sectionId="overview" className="space-y-4">

          <div className="grid gap-4 md:grid-cols-3">

            <Card>

              <CardHeader className="pb-2">

                <CardTitle className="text-sm font-medium">Factures vente</CardTitle>

                <CardDescription>{saleInvoices.length} document{saleInvoices.length !== 1 ? 's' : ''}</CardDescription>

              </CardHeader>

              <CardContent>
                <FinanceAmount amount={salesTtcTotal} kind="income" className="text-2xl" />
              </CardContent>

            </Card>

            {showPurchases && (

              <Card>

                <CardHeader className="pb-2">

                  <CardTitle className="text-sm font-medium">Factures achat</CardTitle>

                  <CardDescription>{purchaseInvoices.length} document{purchaseInvoices.length !== 1 ? 's' : ''}</CardDescription>

                </CardHeader>

                <CardContent>
                  <FinanceAmount amount={purchasesTtcTotal} kind="charge" className="text-2xl" />
                </CardContent>

              </Card>

            )}

            <Card>

              <CardHeader className="pb-2">

                <CardTitle className="text-sm font-medium">Encaissements</CardTitle>

                <CardDescription>{payments.length} règlement{payments.length !== 1 ? 's' : ''}</CardDescription>

              </CardHeader>

              <CardContent>
                <FinanceAmount amount={clientPaymentsTotal} kind="income" className="text-2xl" />
              </CardContent>

            </Card>

          </div>

          <FinanceOverviewCharts
            saleInvoices={saleInvoices}
            purchaseInvoices={purchaseInvoices}
            payments={payments}
            showPurchases={showPurchases}
            loading={loading}
          />

          </FinanceWorkArea>

        </TabsContent>



        {/* ——— Documents sources ——— */}

        <TabsContent value="sources" className="mt-5 space-y-4">
          <FinanceSubNav
            sectionId="sources"
            items={sourcesSubs}
            value={sourcesSub}
            onValueChange={setSourcesSub}
          />

          <FinanceWorkArea sectionId="sources">
          {sourcesSub === 'pieces' && (
            <CommercialSourcesPanel
              companyId={company.id}
              showPurchases={showPurchases}
              onInvoiceCreated={load}
            />
          )}
          </FinanceWorkArea>

        </TabsContent>



        {/* ——— Facturation ——— */}

        <TabsContent value="billing" className="mt-5 space-y-4">
          <FinanceSubNav
            sectionId="billing"
            items={billingSubs}
            value={billingSub}
            onValueChange={setBillingSub}
          />

          <FinanceWorkArea sectionId="billing">

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

            <AvoirsHubPanel

              companyId={company.id}

              clients={clientsOptions}

              fournisseurs={fournisseursOptions}

              saleInvoices={saleInvoices}

              purchaseInvoices={purchaseInvoices}

              linesByInvoice={linesByInvoice}

              showPurchases={showPurchases}

              onCreated={load}

            />

          )}

          </FinanceWorkArea>

        </TabsContent>



        {/* ——— Règlements & créances ——— */}

        <TabsContent value="settlements" className="mt-5 space-y-4">
          <FinanceSubNav
            sectionId="settlements"
            items={settlementsSubs}
            value={settlementsSub}
            onValueChange={setSettlementsSub}
          />

          <FinanceWorkArea sectionId="settlements">

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

            <PaymentHistoryPanel

              title="Historique — encaissements clients"

              loading={loading}

              payments={clientPayments}

              amountKind="income"

            />

          )}

          {settlementsSub === 'history-suppliers' && showSupplierPay && (

            <PaymentHistoryPanel

              title="Historique — décaissements fournisseurs"

              loading={loading}

              payments={supplierPayments}

              amountKind="charge"

            />

          )}

          {settlementsSub === 'aged-balance' && (

            <AgedBalancePanel saleInvoices={saleInvoices} purchaseInvoices={purchaseInvoices} />

          )}

          {settlementsSub === 'disputes' && <UnpaidDisputesPanel invoices={invoices} />}

          </FinanceWorkArea>

        </TabsContent>



        {/* ——— Trésorerie ——— */}

        <TabsContent value="treasury" className="mt-5 space-y-4">

          <TreasuryHubPanel
            companyId={company.id}
            clientPaymentsTotal={clientPaymentsTotal}
            payments={payments}
          />

        </TabsContent>



        {/* ——— Fiscalité ——— */}

        {capabilities.vatDeclarations && (

          <TabsContent value="fiscal" className="mt-5 space-y-4">
            <FinanceSubNav
              sectionId="fiscal"
              items={fiscalSubs}
              value={fiscalSub}
              onValueChange={setFiscalSub}
            />

            <FinanceWorkArea sectionId="fiscal">

            {fiscalSub === 'vat' && (
              <VatDeclarationDashboard companyId={company.id} companyName={company.name} />
            )}

            {fiscalSub === 'withholding' && capabilities.supplierWithholding && companyForTej && (

              <CertificatRetenuePanel

                company={companyForTej}

                clients={clientsOptions}

                fournisseurs={fournisseursOptions}

                sampleInvoices={purchaseInvoices.slice(0, 3).map((inv) => ({

                  numero: inv.numero,

                  montantHt: Number(inv.total_ht),

                }))}

                onCompanyTejUpdated={setTejCompanyPatch}

              />

            )}

            {fiscalSub === 'payroll-slips' && (
              <PayrollSlipsPanel companyId={company.id} companyName={company.name} />
            )}

            {fiscalSub === 'cnss-declaration' && (
              <CnssDeclarationPanel companyId={company.id} companyName={company.name} />
            )}

            </FinanceWorkArea>

          </TabsContent>

        )}



        {/* ——— Comptabilité ——— */}

        {capabilities.statements && (

          <TabsContent value="accounting" className="mt-5 space-y-4">
            <FinanceWorkArea sectionId="accounting">

            <AccountingStatementsPanel companyId={company.id} />

            </FinanceWorkArea>

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


