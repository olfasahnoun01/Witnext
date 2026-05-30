import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CounterpartyOption } from '../../types/paymentTypes';
import type { InvoiceLineRow, InvoiceRow } from '../../types';
import { AvoirFinancierPanel } from './AvoirFinancierPanel';
import { AvoirParArticlePanel } from './AvoirParArticlePanel';

interface AvoirsHubPanelProps {
  companyId: string;
  clients: CounterpartyOption[];
  fournisseurs: CounterpartyOption[];
  saleInvoices: InvoiceRow[];
  purchaseInvoices: InvoiceRow[];
  linesByInvoice: Record<string, InvoiceLineRow[]>;
  showPurchases: boolean;
  onCreated?: () => void;
}

/** Hub avoirs : financier et par article. */
export function AvoirsHubPanel({
  companyId,
  clients,
  fournisseurs,
  saleInvoices,
  purchaseInvoices,
  linesByInvoice,
  showPurchases,
  onCreated,
}: AvoirsHubPanelProps) {
  return (
    <Tabs defaultValue="financier" className="w-full">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="financier">Avoir financier</TabsTrigger>
        <TabsTrigger value="article-vente">Avoir par article (client)</TabsTrigger>
        {showPurchases && (
          <TabsTrigger value="article-achat">Avoir par article (fournisseur)</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="financier" className="mt-4">
        <AvoirFinancierPanel
          companyId={companyId}
          clients={clients}
          fournisseurs={fournisseurs}
          onCreated={onCreated}
        />
      </TabsContent>

      <TabsContent value="article-vente" className="mt-4">
        <AvoirParArticlePanel
          companyId={companyId}
          invoiceType="vente"
          invoices={saleInvoices}
          linesByInvoice={linesByInvoice}
          counterparties={clients}
          onCreated={onCreated}
        />
      </TabsContent>

      {showPurchases && (
        <TabsContent value="article-achat" className="mt-4">
          <AvoirParArticlePanel
            companyId={companyId}
            invoiceType="achat"
            invoices={purchaseInvoices}
            linesByInvoice={linesByInvoice}
            counterparties={fournisseurs}
            onCreated={onCreated}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
