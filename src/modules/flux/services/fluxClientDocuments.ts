/**
 * Fetch commercial parties and documents to start or link a flux dossier.
 */

import { supabase } from '@/integrations/supabase/client';
import { DEVIS_FLUX_SELECT_LITE, queryDevisFluxRowsLite, resolveBcIdFromBlRow } from './devisFluxFields';

export type FluxDirection = 'vente' | 'achat';
export type FluxPartyKind = 'client' | 'fournisseur';

export type FluxDocumentKind =
  | 'devis'
  | 'bc'
  | 'bl'
  | 'ba'
  | 'facture'
  | 'bs'
  | 'be'
  | 'bc_client'
  | 'bl_client'
  | 'bc_fournisseur'
  | 'bl_fournisseur'
  | 'devis_fournisseur';

export interface FluxPartyOption {
  id: number | null;
  nom: string;
  kind: FluxPartyKind;
  /** Master data vs name found on existing devis */
  source: 'registry' | 'devis';
}

export interface FluxDocumentOption {
  kind: FluxDocumentKind;
  label: string;
  id: string;
  numero: string;
  date: string;
  status: string;
  direction: FluxDirection;
  /** Resolved legacy BC devis id when available (vente BC for full flux) */
  anchorBcDevisId: number | null;
  anchorDevisId: number | null;
  anchorDocumentId: string | null;
  raw: unknown;
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function partyKindForDirection(direction: FluxDirection): FluxPartyKind {
  return direction === 'vente' ? 'client' : 'fournisseur';
}

function matchesPartyName(
  thirdPartyName: string | null | undefined,
  partyName: string,
  partyId: number | null,
  rowPartyId?: number | null
): boolean {
  const pn = norm(partyName);
  if (!pn) return false;
  if (partyId != null && rowPartyId != null && partyId === rowPartyId) return true;
  const tn = norm(thirdPartyName);
  if (!tn) return false;
  return tn === pn || tn.includes(pn) || pn.includes(tn);
}

function devisCompanyFilter<T extends { or: (filter: string) => T }>(q: T, companyId: string): T {
  return q.or(`company_id.eq.${companyId},company_id.is.null`);
}

function mergePartyLists(
  registry: { id: number; nom: string }[],
  devisNames: string[],
  kind: FluxPartyKind
): FluxPartyOption[] {
  const seen = new Set<string>();
  const out: FluxPartyOption[] = [];

  for (const row of registry) {
    const nom = row.nom?.trim();
    if (!nom) continue;
    const key = norm(nom);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: row.id, nom, kind, source: 'registry' });
  }

  for (const raw of devisNames) {
    const nom = raw.trim();
    if (!nom) continue;
    const key = norm(nom);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: null, nom, kind, source: 'devis' });
  }

  return out.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export async function fetchFluxParties(
  companyId: string,
  direction: FluxDirection
): Promise<FluxPartyOption[]> {
  const kind = partyKindForDirection(direction);

  let devisQuery = supabase
    .from('devis')
    .select('third_party_name')
    .eq('type', direction)
    .not('third_party_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000);
  devisQuery = devisCompanyFilter(devisQuery, companyId);

  if (direction === 'vente') {
    const [clientsRes, devisRes] = await Promise.all([
      supabase.from('clients').select('id, nom').eq('company_id', companyId).order('nom'),
      devisQuery,
    ]);
    if (clientsRes.error) throw new Error(clientsRes.error.message);
    if (devisRes.error) throw new Error(devisRes.error.message);

    const devisNames = [
      ...new Set(
        (devisRes.data ?? [])
          .map((d) => (d.third_party_name as string | null)?.trim())
          .filter(Boolean) as string[]
      ),
    ];

    return mergePartyLists((clientsRes.data ?? []) as { id: number; nom: string }[], devisNames, kind);
  }

  const [fournisseursRes, devisRes] = await Promise.all([
    supabase.from('fournisseurs').select('id, nom').eq('company_id', companyId).order('nom'),
    devisQuery,
  ]);
  if (fournisseursRes.error) throw new Error(fournisseursRes.error.message);
  if (devisRes.error) throw new Error(devisRes.error.message);

  const devisNames = [
    ...new Set(
      (devisRes.data ?? [])
        .map((d) => (d.third_party_name as string | null)?.trim())
        .filter(Boolean) as string[]
    ),
  ];

  return mergePartyLists(
    (fournisseursRes.data ?? []) as { id: number; nom: string }[],
    devisNames,
    kind
  );
}

/** @deprecated use fetchFluxParties */
export async function fetchClientsForFlux(companyId: string): Promise<{ id: number; nom: string }[]> {
  const parties = await fetchFluxParties(companyId, 'vente');
  return parties.map((p) => ({ id: p.id ?? -1, nom: p.nom })).filter((p) => p.id > 0);
}

export async function fetchPartyFluxDocuments(
  companyId: string,
  direction: FluxDirection,
  partyName: string,
  partyId: number | null
): Promise<FluxDocumentOption[]> {
  const name = partyName.trim();
  if (!name) return [];

  if (direction === 'achat') {
    return fetchAchatFluxDocuments(companyId, name, partyId);
  }
  return fetchVenteFluxDocuments(companyId, name, partyId);
}

/** @deprecated use fetchPartyFluxDocuments */
export async function fetchClientFluxDocuments(
  companyId: string,
  clientName: string,
  clientId: number | null
): Promise<FluxDocumentOption[]> {
  return fetchPartyFluxDocuments(companyId, 'vente', clientName, clientId);
}

async function fetchVenteFluxDocuments(
  companyId: string,
  name: string,
  partyId: number | null
): Promise<FluxDocumentOption[]> {
  type DevisLiteRow = {
    id: number;
    devis_number: string;
    devis_date?: string;
    created_at?: string;
    is_bc?: boolean;
    is_bl?: boolean;
    is_ba?: boolean;
    status: string;
    third_party_name?: string | null;
    source_devis_id?: number | null;
    source_bc_id?: number | null;
  };

  const [devisRows, facturesRes, docsRes] = await Promise.all([
    queryDevisFluxRowsLite((select) =>
      devisCompanyFilter(
        supabase
          .from('devis')
          .select(select)
          .eq('type', 'vente')
          .order('created_at', { ascending: false })
          .limit(500),
        companyId
      )
    ) as Promise<DevisLiteRow[]>,
    devisCompanyFilter(
      (supabase as any)
        .from('factures')
        .select('id, numero, date_creation, status, third_party_name, source_bc_id, source_bl_id, type')
        .eq('type', 'vente')
        .order('created_at', { ascending: false })
        .limit(300),
      companyId
    ),
    supabase
      .from('documents')
      .select('id, type, numero, status, created_at, client_id, metadata, parent_id')
      .eq('company_id', companyId)
      .in('type', ['BC_CLIENT', 'BL_CLIENT', 'BS'])
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  if (facturesRes.error) throw new Error(facturesRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);

  const factureRows = facturesRes.data ?? [];
  const docRows = docsRes.data ?? [];

  const bcBySourceDevis = new Map<number, number>();
  for (const d of devisRows) {
    if (d.is_bc && d.source_devis_id) {
      bcBySourceDevis.set(d.source_devis_id, d.id);
    }
  }

  const devisById = new Map(devisRows.map((d) => [d.id, d]));

  const resolveBcFromBl = (blId: number | null | undefined): number | null => {
    if (blId == null) return null;
    const bl = devisById.get(blId);
    return bl ? resolveBcIdFromBlRow(bl) : null;
  };

  const docById = new Map(docRows.map((d) => [d.id, d]));
  const resolveBcFromV2Doc = (docId: string): number | null => {
    let current = docById.get(docId);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.type === 'BC_CLIENT') {
        const legacyId = (current.metadata as Record<string, unknown> | null)?.legacy_id;
        const n = legacyId != null ? parseInt(String(legacyId), 10) : NaN;
        if (Number.isFinite(n)) return n;
      }
      if (!current.parent_id) break;
      current = docById.get(current.parent_id);
    }
    return null;
  };

  const options: FluxDocumentOption[] = [];

  for (const d of devisRows) {
    if (!matchesPartyName(d.third_party_name, name, partyId)) continue;
    if (d.is_ba) continue;

    if (d.is_bl) {
      options.push({
        kind: 'bl',
        label: 'Bon de livraison',
        id: String(d.id),
        numero: d.devis_number,
        date: d.devis_date ?? d.created_at?.slice(0, 10) ?? '',
        status: d.status,
        direction: 'vente',
        anchorBcDevisId: resolveBcIdFromBlRow(d),
        anchorDevisId: d.source_devis_id ?? null,
        anchorDocumentId: null,
        raw: d,
      });
    } else if (d.is_bc) {
      options.push({
        kind: 'bc',
        label: 'Bon de commande client',
        id: String(d.id),
        numero: d.devis_number,
        date: d.devis_date ?? d.created_at?.slice(0, 10) ?? '',
        status: d.status,
        direction: 'vente',
        anchorBcDevisId: d.id,
        anchorDevisId: d.source_devis_id ?? null,
        anchorDocumentId: null,
        raw: d,
      });
    } else {
      const linkedBc = bcBySourceDevis.get(d.id) ?? null;
      options.push({
        kind: 'devis',
        label: 'Devis client',
        id: String(d.id),
        numero: d.devis_number,
        date: d.devis_date ?? d.created_at?.slice(0, 10) ?? '',
        status: d.status,
        direction: 'vente',
        anchorBcDevisId: linkedBc,
        anchorDevisId: d.id,
        anchorDocumentId: null,
        raw: d,
      });
    }
  }

  for (const f of factureRows) {
    if (!matchesPartyName(f.third_party_name, name, partyId)) continue;
    options.push({
      kind: 'facture',
      label: 'Facture client',
      id: String(f.id),
      numero: f.numero,
      date: f.date_creation ?? '',
      status: f.status,
      direction: 'vente',
      anchorBcDevisId: f.source_bc_id ?? resolveBcFromBl(f.source_bl_id) ?? null,
      anchorDevisId: null,
      anchorDocumentId: null,
      raw: f,
    });
  }

  for (const doc of docRows) {
    const rowClientId = doc.client_id as number | null;
    const metaClient = (doc.metadata as Record<string, unknown> | null)?.client_name as string | undefined;
    if (!matchesPartyName(metaClient ?? null, name, partyId, rowClientId)) continue;

    const legacyId = (doc.metadata as Record<string, unknown> | null)?.legacy_id;
    let anchorBc = legacyId != null ? parseInt(String(legacyId), 10) : NaN;
    if (!Number.isFinite(anchorBc)) {
      anchorBc = resolveBcFromV2Doc(doc.id) ?? NaN;
    }

    let kind: FluxDocumentKind;
    let label: string;
    switch (doc.type) {
      case 'BC_CLIENT':
        kind = 'bc_client';
        label = 'BC client (magasin)';
        break;
      case 'BL_CLIENT':
        kind = 'bl_client';
        label = 'BL client (magasin)';
        break;
      case 'BS':
        kind = 'bs';
        label = 'Bon de sortie stock';
        break;
      default:
        continue;
    }

    options.push({
      kind,
      label,
      id: doc.id,
      numero: doc.numero,
      date: doc.created_at?.slice(0, 10) ?? '',
      status: doc.status,
      direction: 'vente',
      anchorBcDevisId: Number.isFinite(anchorBc) ? anchorBc : null,
      anchorDevisId: null,
      anchorDocumentId: doc.id,
      raw: doc,
    });
  }

  return options.sort((a, b) => b.date.localeCompare(a.date));
}

async function fetchAchatFluxDocuments(
  companyId: string,
  name: string,
  partyId: number | null
): Promise<FluxDocumentOption[]> {
  type DevisLiteRow = {
    id: number;
    devis_number: string;
    devis_date?: string;
    created_at?: string;
    is_bc?: boolean;
    is_ba?: boolean;
    status: string;
    third_party_name?: string | null;
    source_devis_id?: number | null;
  };

  const [devisRows, facturesRes, docsRes] = await Promise.all([
    queryDevisFluxRowsLite((select) =>
      devisCompanyFilter(
        supabase
          .from('devis')
          .select(select)
          .eq('type', 'achat')
          .order('created_at', { ascending: false })
          .limit(500),
        companyId
      )
    ) as Promise<DevisLiteRow[]>,
    devisCompanyFilter(
      (supabase as any)
        .from('factures')
        .select('id, numero, date_creation, status, third_party_name, source_bc_id, type')
        .eq('type', 'achat')
        .order('created_at', { ascending: false })
        .limit(300),
      companyId
    ),
    supabase
      .from('documents')
      .select('id, type, numero, status, created_at, fournisseur_id, metadata, parent_id')
      .eq('company_id', companyId)
      .in('type', ['BC_FOURNISSEUR', 'BL_FOURNISSEUR', 'BE', 'DEVIS_FOURNISSEUR', 'DEMANDE_ACHAT'])
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  if (facturesRes.error) throw new Error(facturesRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);

  const factureRows = facturesRes.data ?? [];
  const docRows = docsRes.data ?? [];

  const options: FluxDocumentOption[] = [];

  for (const d of devisRows) {
    if (!matchesPartyName(d.third_party_name, name, partyId)) continue;

    if (d.is_ba) {
      options.push({
        kind: 'ba',
        label: "Bon d'achat",
        id: String(d.id),
        numero: d.devis_number,
        date: d.devis_date ?? d.created_at?.slice(0, 10) ?? '',
        status: d.status,
        direction: 'achat',
        anchorBcDevisId: null,
        anchorDevisId: d.source_devis_id ?? d.id,
        anchorDocumentId: null,
        raw: d,
      });
    } else if (d.is_bc) {
      options.push({
        kind: 'bc',
        label: 'BC fournisseur',
        id: String(d.id),
        numero: d.devis_number,
        date: d.devis_date ?? d.created_at?.slice(0, 10) ?? '',
        status: d.status,
        direction: 'achat',
        anchorBcDevisId: null,
        anchorDevisId: d.source_devis_id ?? null,
        anchorDocumentId: null,
        raw: d,
      });
    } else {
      options.push({
        kind: 'devis',
        label: 'Devis fournisseur',
        id: String(d.id),
        numero: d.devis_number,
        date: d.devis_date ?? d.created_at?.slice(0, 10) ?? '',
        status: d.status,
        direction: 'achat',
        anchorBcDevisId: null,
        anchorDevisId: d.id,
        anchorDocumentId: null,
        raw: d,
      });
    }
  }

  for (const f of factureRows) {
    if (!matchesPartyName(f.third_party_name, name, partyId)) continue;
    options.push({
      kind: 'facture',
      label: 'Facture fournisseur',
      id: String(f.id),
      numero: f.numero,
      date: f.date_creation ?? '',
      status: f.status,
      direction: 'achat',
      anchorBcDevisId: null,
      anchorDevisId: null,
      anchorDocumentId: null,
      raw: f,
    });
  }

  for (const doc of docRows) {
    const rowFournisseurId = doc.fournisseur_id as number | null;
    const metaName =
      ((doc.metadata as Record<string, unknown> | null)?.fournisseur_name as string | undefined) ??
      ((doc.metadata as Record<string, unknown> | null)?.third_party_name as string | undefined);
    if (!matchesPartyName(metaName, name, partyId, rowFournisseurId)) continue;

    let kind: FluxDocumentKind;
    let label: string;
    switch (doc.type) {
      case 'BC_FOURNISSEUR':
        kind = 'bc_fournisseur';
        label = 'BC fournisseur (magasin)';
        break;
      case 'BL_FOURNISSEUR':
        kind = 'bl_fournisseur';
        label = 'BL fournisseur (magasin)';
        break;
      case 'BE':
        kind = 'be';
        label = "Bon d'entrée stock";
        break;
      case 'DEVIS_FOURNISSEUR':
        kind = 'devis_fournisseur';
        label = 'Devis fournisseur (magasin)';
        break;
      default:
        kind = 'devis';
        label = doc.type;
        break;
    }

    options.push({
      kind,
      label,
      id: doc.id,
      numero: doc.numero,
      date: doc.created_at?.slice(0, 10) ?? '',
      status: doc.status,
      direction: 'achat',
      anchorBcDevisId: null,
      anchorDevisId: null,
      anchorDocumentId: doc.id,
      raw: doc,
    });
  }

  return options.sort((a, b) => b.date.localeCompare(a.date));
}

export function fluxDocumentKindLabel(kind: FluxDocumentKind): string {
  switch (kind) {
    case 'devis':
      return 'Devis';
    case 'bc':
      return 'BC';
    case 'bl':
      return 'BL';
    case 'ba':
      return 'BA';
    case 'facture':
      return 'Facture';
    case 'bs':
      return 'BS';
    case 'be':
      return 'BE';
    case 'bc_client':
      return 'BC magasin';
    case 'bl_client':
      return 'BL magasin';
    case 'bc_fournisseur':
      return 'BC fr. magasin';
    case 'bl_fournisseur':
      return 'BL fr. magasin';
    case 'devis_fournisseur':
      return 'Devis fr. magasin';
  }
}
