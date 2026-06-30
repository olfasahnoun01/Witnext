import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileMinus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppCompany, useCompanyChangeReload } from '@/contexts/AppCompanyContext';
import { AvoirFinancierPanel } from '@/modules/finance/components/avoirs/AvoirFinancierPanel';
import { AvoirParArticlePanel } from '@/modules/finance/components/avoirs/AvoirParArticlePanel';
import { listInvoiceLines, listInvoices } from '@/modules/finance/services/financeApi';
import {
  fetchClientsForSettlement,
  fetchFournisseursForSettlement,
} from '@/modules/finance/services/paymentApi';
import type { InvoiceLineRow, InvoiceRow } from '@/modules/finance/types';
import type { CounterpartyOption } from '@/modules/finance/types/paymentTypes';
import type { AvoirFinancierType } from '@/modules/finance/types/financeDomain';

interface CommercialAvoirPageProps {
  flow: AvoirFinancierType;
  title: string;
}

export function CommercialAvoirPage({ flow, title }: CommercialAvoirPageProps) {
  const { currentCompany, loading: companyLoading } = useAppCompany();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineRow[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentCompany?.id) {
      setInvoices([]);
      setInvoiceLines([]);
      setCounterparties([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const inv = await listInvoices(currentCompany.id);
      const filtered = inv.filter((i) => i.invoice_type === flow);
      const lineRows = await listInvoiceLines(filtered.map((x) => x.id));
      const tiers =
        flow === 'vente'
          ? await fetchClientsForSettlement(currentCompany.id)
          : await fetchFournisseursForSettlement(currentCompany.id);

      setInvoices(filtered);
      setInvoiceLines(lineRows);
      setCounterparties(tiers);
    } catch (e) {
      console.error(e);
      toast.error('Impossible de charger les données des avoirs');
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, flow]);

  useEffect(() => {
    if (companyLoading) return;
    void load();
  }, [companyLoading, load]);

  useCompanyChangeReload(load);

  const linesByInvoice = useMemo(
    () =>
      invoiceLines.reduce<Record<string, InvoiceLineRow[]>>((acc, line) => {
        if (!acc[line.invoice_id]) acc[line.invoice_id] = [];
        acc[line.invoice_id].push(line);
        return acc;
      }, {}),
    [invoiceLines]
  );

  if (companyLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Aucune société active. Sélectionnez une société pour gérer les avoirs.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileMinus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Avoirs financiers et par article — {currentCompany.name}
          </p>
        </div>
      </div>

      <Tabs defaultValue="financier" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="financier">Avoir financier</TabsTrigger>
          <TabsTrigger value="article">Avoir par article</TabsTrigger>
        </TabsList>

        <TabsContent value="financier" className="mt-4">
          <AvoirFinancierPanel
            companyId={currentCompany.id}
            clients={flow === 'vente' ? counterparties : []}
            fournisseurs={flow === 'achat' ? counterparties : []}
            lockType={flow}
            onCreated={load}
          />
        </TabsContent>

        <TabsContent value="article" className="mt-4">
          <AvoirParArticlePanel
            companyId={currentCompany.id}
            invoiceType={flow}
            invoices={invoices}
            linesByInvoice={linesByInvoice}
            counterparties={counterparties}
            onCreated={load}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function AvoirClientPage() {
  return <CommercialAvoirPage flow="vente" title="Avoir Client" />;
}

export function AvoirFournisseurPage() {
  return <CommercialAvoirPage flow="achat" title="Avoir Fournisseur" />;
}
