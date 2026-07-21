import { supabase } from '@/integrations/supabase/client';

export type DriverVisitRapport = {
  id: string;
  siteId: string;
  siteNom: string | null;
  conducteurId: string;
  conducteurNom: string;
  description: string;
  imageUrls: string[];
  createdAt: string;
};

type RapportRow = {
  id: string;
  site_id: string;
  conducteur_id: string;
  conducteur_nom: string | null;
  description: string | null;
  image_urls: string[] | null;
  created_at: string;
  sites?: { nom?: string | null } | null;
};

function mapRow(row: RapportRow): DriverVisitRapport {
  return {
    id: row.id,
    siteId: row.site_id,
    siteNom: row.sites?.nom ?? null,
    conducteurId: row.conducteur_id,
    conducteurNom: row.conducteur_nom?.trim() || 'Chauffeur',
    description: row.description?.trim() || '',
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [],
    createdAt: row.created_at,
  };
}

/** Visit reports submitted from the NextDrive / chauffeur mobile app (`public.rapports`). */
export async function fetchDriverVisitRapports(): Promise<DriverVisitRapport[]> {
  // `rapports` is not in generated Database types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rapports')
    .select('id, site_id, conducteur_id, conducteur_nom, description, image_urls, created_at, sites(nom)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[RH] fetch driver visit rapports:', error.message);
    throw new Error(error.message);
  }

  return ((data || []) as RapportRow[]).map(mapRow);
}
