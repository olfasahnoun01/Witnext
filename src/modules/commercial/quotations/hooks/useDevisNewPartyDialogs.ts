import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { ClientTvaStatus } from '@/config/sectionThemes';
import { TUNISIA_LOCATIONS } from '@/constants/tunisia';
import { useClientDocumentPreview } from '@/hooks/useClientDocumentPreview';
import { supabase } from '@/integrations/supabase/client';
import { getActiveCompanyId } from '@/lib/activeCompany';
import { generateNextEntityCode } from '@/lib/entityCode';
import { formatPhonesDisplay, serializePhoneList } from '@/lib/phoneList';
import {
  partyPhoneToLines,
  parsePartyAddressFields,
} from '@/modules/commercial/quotations/lib/devisPartyUtils';
import type {
  DevisPartyClient,
  DevisPartyFournisseur,
} from '@/modules/commercial/quotations/types/devisFormTypes';
import { toast } from 'sonner';

export type UseDevisNewPartyDialogsArgs = {
  isAchat: boolean;
  thirdPartyName: string;
  thirdPartyAddress: string;
  thirdPartyTaxId: string;
  thirdPartyPhone: string;
  thirdPartyTvaStatus: ClientTvaStatus | null;
  clients: DevisPartyClient[];
  fournisseurs: DevisPartyFournisseur[];
  setClients: Dispatch<SetStateAction<DevisPartyClient[]>>;
  setFournisseurs: Dispatch<SetStateAction<DevisPartyFournisseur[]>>;
  setSelectedThirdPartyId: (id: string) => void;
  setThirdPartyName: (v: string) => void;
  setThirdPartyAddress: (v: string) => void;
  setThirdPartyTaxId: (v: string) => void;
  setThirdPartyPhone: (v: string) => void;
  partyTvaPolicyKeyRef: MutableRefObject<string | null>;
};

export function useDevisNewPartyDialogs({
  isAchat,
  thirdPartyName,
  thirdPartyAddress,
  thirdPartyTaxId,
  thirdPartyPhone,
  thirdPartyTvaStatus,
  clients,
  fournisseurs,
  setClients,
  setFournisseurs,
  setSelectedThirdPartyId,
  setThirdPartyName,
  setThirdPartyAddress,
  setThirdPartyTaxId,
  setThirdPartyPhone,
  partyTvaPolicyKeyRef,
}: UseDevisNewPartyDialogsArgs) {
  const [showNewFournisseur, setShowNewFournisseur] = useState(false);
  const [newFournisseurName, setNewFournisseurName] = useState('');
  const [newFournisseurMatricule, setNewFournisseurMatricule] = useState('');
  const [newFournisseurSpecialite, setNewFournisseurSpecialite] = useState('');
  const [newFournisseurGovernorate, setNewFournisseurGovernorate] = useState('');
  const [newFournisseurCity, setNewFournisseurCity] = useState('');
  const [newFournisseurCode, setNewFournisseurCode] = useState('');
  const [newFournisseurPhoneLines, setNewFournisseurPhoneLines] = useState<string[]>(['']);
  const [newFournisseurPatenteUrl, setNewFournisseurPatenteUrl] = useState<string | null>(null);
  const [newFournisseurRneUrl, setNewFournisseurRneUrl] = useState<string | null>(null);

  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [newClientMatricule, setNewClientMatricule] = useState('');
  const [newClientGovernorate, setNewClientGovernorate] = useState('');
  const [newClientCity, setNewClientCity] = useState('');
  const [newClientPhoneLines, setNewClientPhoneLines] = useState<string[]>(['']);
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientNatureActivite, setNewClientNatureActivite] = useState('');
  const [newClientExactLocation, setNewClientExactLocation] = useState('');
  const [newClientPatenteUrl, setNewClientPatenteUrl] = useState<string | null>(null);
  const [newClientRcUrl, setNewClientRcUrl] = useState<string | null>(null);
  const [newClientAttestationUrl, setNewClientAttestationUrl] = useState<string | null>(null);
  const [newClientTvaStatus, setNewClientTvaStatus] = useState<ClientTvaStatus>('assujetti');

  const { preview: documentPreview, pdfBytesRef, openDocumentPreview, closePreview: closeDocumentPreview } =
    useClientDocumentPreview();

  const newFournisseurCities = useMemo(() => {
    return newFournisseurGovernorate
      ? TUNISIA_LOCATIONS.find((r) => r.governorate === newFournisseurGovernorate)?.cities || []
      : [];
  }, [newFournisseurGovernorate]);

  const resetNewFournisseurForm = useCallback(() => {
    setNewFournisseurName('');
    setNewFournisseurMatricule('');
    setNewFournisseurSpecialite('');
    setNewFournisseurGovernorate('');
    setNewFournisseurCity('');
    setNewFournisseurCode('');
    setNewFournisseurPhoneLines(['']);
    setNewFournisseurPatenteUrl(null);
    setNewFournisseurRneUrl(null);
  }, []);

  const newClientCities = useMemo(() => {
    return newClientGovernorate
      ? TUNISIA_LOCATIONS.find((r) => r.governorate === newClientGovernorate)?.cities || []
      : [];
  }, [newClientGovernorate]);

  const resetNewClientForm = useCallback(() => {
    setNewClientName('');
    setNewClientMatricule('');
    setNewClientGovernorate('');
    setNewClientCity('');
    setNewClientCode('');
    setNewClientPhoneLines(['']);
    setNewClientEmail('');
    setNewClientNatureActivite('');
    setNewClientExactLocation('');
    setNewClientPatenteUrl(null);
    setNewClientRcUrl(null);
    setNewClientAttestationUrl(null);
    setNewClientTvaStatus('assujetti');
  }, []);

  useEffect(() => {
    if (!showNewClient) return;
    const codes = clients.map((c) => c.code).filter(Boolean) as string[];
    setNewClientCode(generateNextEntityCode(codes));
  }, [showNewClient, clients]);

  useEffect(() => {
    if (!showNewFournisseur) return;
    const codes = fournisseurs.map((f) => f.code).filter(Boolean) as string[];
    setNewFournisseurCode(generateNextEntityCode(codes, 'FRN-', 3));
  }, [showNewFournisseur, fournisseurs]);

  const prefillNewClientFromPartyTable = useCallback(() => {
    const { exactLocation, city, governorate } = parsePartyAddressFields(thirdPartyAddress);
    setNewClientName(thirdPartyName.trim());
    setNewClientMatricule(thirdPartyTaxId.trim());
    setNewClientPhoneLines(partyPhoneToLines(thirdPartyPhone));
    setNewClientExactLocation(exactLocation);
    setNewClientGovernorate(governorate);
    setNewClientCity(city);
    if (thirdPartyTvaStatus) {
      setNewClientTvaStatus(thirdPartyTvaStatus);
    }
  }, [
    thirdPartyName,
    thirdPartyTaxId,
    thirdPartyPhone,
    thirdPartyAddress,
    thirdPartyTvaStatus,
  ]);

  const prefillNewFournisseurFromPartyTable = useCallback(() => {
    const { exactLocation, city, governorate } = parsePartyAddressFields(thirdPartyAddress);
    setNewFournisseurName(thirdPartyName.trim());
    setNewFournisseurMatricule(thirdPartyTaxId.trim());
    setNewFournisseurPhoneLines(partyPhoneToLines(thirdPartyPhone));
    setNewFournisseurGovernorate(governorate);
    setNewFournisseurCity(city);
    if (!city && !governorate && exactLocation) {
      const fallback = parsePartyAddressFields(exactLocation);
      if (fallback.city || fallback.governorate) {
        setNewFournisseurCity(fallback.city);
        setNewFournisseurGovernorate(fallback.governorate);
      }
    }
  }, [thirdPartyName, thirdPartyTaxId, thirdPartyPhone, thirdPartyAddress]);

  const openNewClientDialog = useCallback(() => {
    resetNewClientForm();
    prefillNewClientFromPartyTable();
    setShowNewClient(true);
  }, [resetNewClientForm, prefillNewClientFromPartyTable]);

  const openNewFournisseurDialog = useCallback(() => {
    resetNewFournisseurForm();
    prefillNewFournisseurFromPartyTable();
    setShowNewFournisseur(true);
  }, [resetNewFournisseurForm, prefillNewFournisseurFromPartyTable]);

  const createClient = useCallback(async () => {
    if (!newClientName.trim()) { toast.error('Nom requis'); return; }
    if (!newClientMatricule.trim()) { toast.error('Matricule fiscal requis'); return; }
    const phoneStored = serializePhoneList(newClientPhoneLines);
    if (!phoneStored) { toast.error('Au moins un numéro de téléphone est requis'); return; }
    if (!newClientCode.trim()) { toast.error('Code client requis'); return; }
    if (!newClientGovernorate || !newClientCity) {
      toast.error('Gouvernorat et ville requis');
      return;
    }

    const locationParts = [newClientExactLocation.trim(), newClientCity, newClientGovernorate].filter(Boolean);
    const locationValue = locationParts.length > 0 ? locationParts.join(', ') : null;
    const companyId = getActiveCompanyId();
    if (!companyId) {
      toast.error('Aucune société active');
      return;
    }

    const { data, error } = await supabase.from('clients').insert({
      nom: newClientName.trim(),
      code: newClientCode.trim(),
      matricule_fiscale: newClientMatricule.trim(),
      tva_status: newClientTvaStatus,
      company_id: companyId,
      phone: phoneStored,
      email: newClientEmail.trim() || null,
      nature_activite: newClientNatureActivite.trim() || null,
      location: locationValue,
      patente_url: newClientPatenteUrl,
      registre_commerce_url: newClientRcUrl,
      attestation_exoneration_url: newClientAttestationUrl,
    }).select().single();

    if (error) {
      toast.error('Erreur création client');
      console.error(error);
    } else if (data) {
      toast.success('Client créé');
      setClients((prev) => [data as DevisPartyClient, ...prev]);
      setThirdPartyName(data.nom);
      setThirdPartyPhone(formatPhonesDisplay((data as DevisPartyClient).phone) || '');
      setThirdPartyAddress((data as DevisPartyClient).location || '');
      setThirdPartyTaxId((data as DevisPartyClient).matricule_fiscale || '');
      setSelectedThirdPartyId(data.id.toString());
      partyTvaPolicyKeyRef.current = null;
      setShowNewClient(false);
      resetNewClientForm();
    }
  }, [
    newClientName,
    newClientMatricule,
    newClientCode,
    newClientGovernorate,
    newClientCity,
    newClientPhoneLines,
    newClientEmail,
    newClientNatureActivite,
    newClientExactLocation,
    newClientPatenteUrl,
    newClientRcUrl,
    newClientAttestationUrl,
    newClientTvaStatus,
    setThirdPartyName,
    setThirdPartyPhone,
    setThirdPartyAddress,
    setThirdPartyTaxId,
    resetNewClientForm,
  ]);

  const createFournisseur = useCallback(async () => {
    if (!newFournisseurName.trim()) { toast.error('Nom requis'); return; }
    if (!newFournisseurSpecialite) { toast.error('Spécialité requise'); return; }
    if (!newFournisseurMatricule.trim()) { toast.error('Matricule fiscal requis'); return; }
    const phoneStored = serializePhoneList(newFournisseurPhoneLines);
    if (!phoneStored) { toast.error('Au moins un numéro de téléphone est requis'); return; }
    if (!newFournisseurCode.trim()) { toast.error('Code fournisseur requis pour les documents'); return; }
    if (!newFournisseurGovernorate || !newFournisseurCity) {
      toast.error('Gouvernorat et ville requis');
      return;
    }

    const locationValue = `${newFournisseurCity}, ${newFournisseurGovernorate}`;
    const companyId = getActiveCompanyId();
    if (!companyId) {
      toast.error('Aucune société active');
      return;
    }

    const { data, error } = await supabase.from('fournisseurs').insert({
      nom: newFournisseurName.trim(),
      code: newFournisseurCode.trim(),
      matricule_fiscale: newFournisseurMatricule.trim(),
      specialite: newFournisseurSpecialite,
      company_id: companyId,
      phone: phoneStored,
      location: locationValue,
      patente_url: newFournisseurPatenteUrl,
      registre_commerce_url: newFournisseurRneUrl,
    }).select().single();
    if (error) {
      toast.error('Erreur création fournisseur');
    } else if (data) {
      toast.success('Fournisseur créé');
      setFournisseurs((prev) => [data as DevisPartyFournisseur, ...prev]);
      if (isAchat) {
        setThirdPartyName(data.nom);
        setThirdPartyPhone(formatPhonesDisplay((data as DevisPartyFournisseur).phone) || '');
        setThirdPartyAddress((data as DevisPartyFournisseur).location || '');
        setThirdPartyTaxId((data as DevisPartyFournisseur).matricule_fiscale || '');
        setSelectedThirdPartyId(data.id.toString());
      }
      setShowNewFournisseur(false);
      resetNewFournisseurForm();
    }
  }, [newFournisseurName, newFournisseurMatricule, newFournisseurSpecialite, newFournisseurGovernorate, newFournisseurCity, newFournisseurCode, newFournisseurPhoneLines, newFournisseurPatenteUrl, newFournisseurRneUrl, isAchat, setThirdPartyName, setThirdPartyPhone, setThirdPartyAddress, setThirdPartyTaxId, resetNewFournisseurForm]);

  const handleFournisseurDialogOpenChange = useCallback((open: boolean) => {
    setShowNewFournisseur(open);
    if (!open) resetNewFournisseurForm();
  }, [resetNewFournisseurForm]);

  const handleClientDialogOpenChange = useCallback((open: boolean) => {
    setShowNewClient(open);
    if (!open) resetNewClientForm();
  }, [resetNewClientForm]);

  const cancelNewFournisseurDialog = useCallback(() => {
    setShowNewFournisseur(false);
    resetNewFournisseurForm();
  }, [resetNewFournisseurForm]);

  const cancelNewClientDialog = useCallback(() => {
    setShowNewClient(false);
    resetNewClientForm();
  }, [resetNewClientForm]);

  const fournisseurDialogProps = {
    open: showNewFournisseur,
    onOpenChange: handleFournisseurDialogOpenChange,
    name: newFournisseurName,
    setName: setNewFournisseurName,
    code: newFournisseurCode,
    setCode: setNewFournisseurCode,
    matricule: newFournisseurMatricule,
    setMatricule: setNewFournisseurMatricule,
    specialite: newFournisseurSpecialite,
    setSpecialite: setNewFournisseurSpecialite,
    governorate: newFournisseurGovernorate,
    setGovernorate: setNewFournisseurGovernorate,
    city: newFournisseurCity,
    setCity: setNewFournisseurCity,
    phoneLines: newFournisseurPhoneLines,
    setPhoneLines: setNewFournisseurPhoneLines,
    patenteUrl: newFournisseurPatenteUrl,
    setPatenteUrl: setNewFournisseurPatenteUrl,
    rneUrl: newFournisseurRneUrl,
    setRneUrl: setNewFournisseurRneUrl,
    cities: newFournisseurCities,
    reset: resetNewFournisseurForm,
    onCreate: createFournisseur,
    onCancel: cancelNewFournisseurDialog,
    openDocumentPreview,
  };

  const clientDialogProps = {
    open: showNewClient,
    onOpenChange: handleClientDialogOpenChange,
    name: newClientName,
    setName: setNewClientName,
    code: newClientCode,
    setCode: setNewClientCode,
    matricule: newClientMatricule,
    setMatricule: setNewClientMatricule,
    governorate: newClientGovernorate,
    setGovernorate: setNewClientGovernorate,
    city: newClientCity,
    setCity: setNewClientCity,
    phoneLines: newClientPhoneLines,
    setPhoneLines: setNewClientPhoneLines,
    email: newClientEmail,
    setEmail: setNewClientEmail,
    natureActivite: newClientNatureActivite,
    setNatureActivite: setNewClientNatureActivite,
    exactLocation: newClientExactLocation,
    setExactLocation: setNewClientExactLocation,
    patenteUrl: newClientPatenteUrl,
    setPatenteUrl: setNewClientPatenteUrl,
    rcUrl: newClientRcUrl,
    setRcUrl: setNewClientRcUrl,
    attestationUrl: newClientAttestationUrl,
    setAttestationUrl: setNewClientAttestationUrl,
    tvaStatus: newClientTvaStatus,
    setTvaStatus: setNewClientTvaStatus,
    cities: newClientCities,
    reset: resetNewClientForm,
    onCreate: createClient,
    onCancel: cancelNewClientDialog,
    openDocumentPreview,
  };

  return {
    openNewFournisseurDialog,
    openNewClientDialog,
    fournisseurDialogProps,
    clientDialogProps,
    documentPreview,
    pdfBytesRef,
    closeDocumentPreview,
  };
}
