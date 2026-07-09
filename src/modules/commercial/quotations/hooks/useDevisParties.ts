import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { filterByCompanyId } from '@/modules/inventory/lib/companyQuery';
import { formatPhonesDisplay } from '@/lib/phoneList';
import {
  DEVIS_DEFAULT_CATEGORIES,
} from '@/modules/commercial/quotations/lib/devisFormConstants';
import type {
  DevisPartyClient,
  DevisPartyFournisseur,
} from '@/modules/commercial/quotations/types/devisFormTypes';

type UseDevisPartiesArgs = {
  devisType: 'achat' | 'vente';
  setThirdPartyName: (v: string) => void;
  setThirdPartyAddress: (v: string) => void;
  setThirdPartyTaxId: (v: string) => void;
  setThirdPartyPhone: (v: string) => void;
};

export function useDevisParties({
  devisType,
  setThirdPartyName,
  setThirdPartyAddress,
  setThirdPartyTaxId,
  setThirdPartyPhone,
}: UseDevisPartiesArgs) {
  const isAchat = devisType === 'achat';
  const [fournisseurs, setFournisseurs] = useState<DevisPartyFournisseur[]>([]);
  const [clients, setClients] = useState<DevisPartyClient[]>([]);
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState('');
  const [dbCategories, setDbCategories] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const cid = getActiveCompanyId();
      let fournQuery = supabase
        .from('fournisseurs')
        .select('id, nom, code, matricule_fiscale, location, phone, patente_url, registre_commerce_url, created_at');
      let clientsQuery = supabase
        .from('clients')
        .select('id, nom, code, matricule_fiscale, location, phone, tva_status, created_at');
      if (cid) {
        fournQuery = filterByCompanyId(fournQuery, cid);
        clientsQuery = filterByCompanyId(clientsQuery, cid);
      }
      const [fRes, cRes, catSettingsRes, productsCatsRes, groupCatsRes] = await Promise.all([
        fournQuery.order('created_at', { ascending: false }),
        clientsQuery.order('created_at', { ascending: false }),
        supabase.from('category_settings').select('category_name'),
        supabase.from('products').select('category'),
        supabase.from('product_groups').select('category'),
      ]);
      if (fRes.data) setFournisseurs(fRes.data as DevisPartyFournisseur[]);
      if (cRes.data) setClients(cRes.data as DevisPartyClient[]);
      const allCats = new Set<string>(DEVIS_DEFAULT_CATEGORIES);
      (catSettingsRes.data || []).forEach((row: { category_name: string | null }) => {
        if (row.category_name) allCats.add(row.category_name);
      });
      (productsCatsRes.data || []).forEach((row: { category: string | null }) => {
        if (row.category?.trim()) allCats.add(row.category.trim());
      });
      (groupCatsRes.data || []).forEach((row: { category: string | null }) => {
        if (row.category?.trim()) allCats.add(row.category.trim());
      });
      setDbCategories([...allCats].sort());
    };
    void load();
  }, []);

  useEffect(() => {
    setSelectedThirdPartyId('');
  }, [devisType]);

  const handleThirdPartyNameChange = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      const list = isAchat ? fournisseurs : clients;
      const match = list.find((item) => item.nom.trim().toLowerCase() === trimmed.toLowerCase());

      setThirdPartyName(value);
      if (!trimmed) {
        setThirdPartyAddress('');
        setThirdPartyTaxId('');
        setThirdPartyPhone('');
        setSelectedThirdPartyId('');
        return;
      }

      if (match) {
        setThirdPartyAddress(match.location || '');
        setThirdPartyTaxId(match.matricule_fiscale || '');
        setThirdPartyPhone(formatPhonesDisplay(match.phone) || '');
        setSelectedThirdPartyId(match.id.toString());
      } else {
        setThirdPartyAddress('');
        setThirdPartyTaxId('');
        setThirdPartyPhone('');
        setSelectedThirdPartyId('');
      }
    },
    [isAchat, fournisseurs, clients, setThirdPartyName, setThirdPartyAddress, setThirdPartyTaxId, setThirdPartyPhone]
  );

  return {
    isAchat,
    fournisseurs,
    setFournisseurs,
    clients,
    setClients,
    selectedThirdPartyId,
    setSelectedThirdPartyId,
    dbCategories,
    handleThirdPartyNameChange,
  };
}
