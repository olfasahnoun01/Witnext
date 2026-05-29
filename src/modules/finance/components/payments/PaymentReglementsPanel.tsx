import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { CounterpartyOption } from '../../types/paymentTypes';
import { fetchClientsForSettlement, fetchFournisseursForSettlement } from '../../services/paymentApi';
import { PaymentSettlementForm } from './PaymentSettlementForm';

interface PaymentReglementsPanelProps {
  companyId: string;
  showClient: boolean;
  showSupplier: boolean;
  onReload?: () => void;
  /** Affiche un seul formulaire sans onglets internes. */
  mode?: 'client' | 'fournisseur' | 'both';
}

/** Panneau règlements : encaissement client et/ou paiement fournisseur. */
export function PaymentReglementsPanel({
  companyId,
  showClient,
  showSupplier,
  onReload,
  mode = 'both',
}: PaymentReglementsPanelProps) {
  const [clients, setClients] = useState<CounterpartyOption[]>([]);
  const [fournisseurs, setFournisseurs] = useState<CounterpartyOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, f] = await Promise.all([
        showClient ? fetchClientsForSettlement() : Promise.resolve([]),
        showSupplier ? fetchFournisseursForSettlement() : Promise.resolve([]),
      ]);
      setClients(c);
      setFournisseurs(f);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chargement des tiers impossible');
    } finally {
      setLoading(false);
    }
  }, [showClient, showSupplier]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8">Chargement des tiers…</p>;
  }

  if (mode === 'client' && showClient) {
    return (
      <PaymentSettlementForm
        companyId={companyId}
        direction="client"
        counterparties={clients}
        onSuccess={onReload}
      />
    );
  }

  if (mode === 'fournisseur' && showSupplier) {
    return (
      <PaymentSettlementForm
        companyId={companyId}
        direction="fournisseur"
        counterparties={fournisseurs}
        onSuccess={onReload}
      />
    );
  }

  const defaultTab = showClient ? 'client' : 'fournisseur';

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList>
        {showClient && <TabsTrigger value="client">Règlement client</TabsTrigger>}
        {showSupplier && <TabsTrigger value="fournisseur">Paiement fournisseur</TabsTrigger>}
      </TabsList>
      {showClient && (
        <TabsContent value="client" className="mt-4">
          <PaymentSettlementForm
            companyId={companyId}
            direction="client"
            counterparties={clients}
            onSuccess={onReload}
          />
        </TabsContent>
      )}
      {showSupplier && (
        <TabsContent value="fournisseur" className="mt-4">
          <PaymentSettlementForm
            companyId={companyId}
            direction="fournisseur"
            counterparties={fournisseurs}
            onSuccess={onReload}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
