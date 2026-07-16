import { supabase } from '@/integrations/supabase/client';
import {
  COMPANY_ASSETS_BUCKET,
  type CompanyBrandingInput,
  type CompanyBrandingRow,
} from '@/lib/companyBranding';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export async function fetchCompanyBranding(companyId: string): Promise<CompanyBrandingRow | null> {
  const { data, error } = await supabase
    .from('companies')
    .select(
      'id, code, name, logo_url, legal_name, address, tel_fax, rib, code_tva, brand_primary_color, brand_header_color, brand_table_color'
    )
    .eq('id', companyId)
    .maybeSingle();

  if (error) throw error;
  return data as CompanyBrandingRow | null;
}

export async function updateCompanyBranding(
  companyId: string,
  input: CompanyBrandingInput
): Promise<CompanyBrandingRow> {
  const { data, error } = await supabase
    .from('companies')
    .update({
      legal_name: input.legal_name?.trim() || null,
      address: input.address?.trim() || null,
      tel_fax: input.tel_fax?.trim() || null,
      rib: input.rib?.trim() || null,
      code_tva: input.code_tva?.trim() || null,
      brand_primary_color: input.brand_primary_color || '#1e2124',
      brand_header_color: input.brand_header_color || '#e6e6e6',
      brand_table_color: input.brand_table_color || '#ebebeb',
      ...(input.logo_url !== undefined ? { logo_url: input.logo_url } : {}),
    })
    .eq('id', companyId)
    .select(
      'id, code, name, logo_url, legal_name, address, tel_fax, rib, code_tva, brand_primary_color, brand_header_color, brand_table_color'
    )
    .single();

  if (error) throw error;
  return data as CompanyBrandingRow;
}

function logoExtension(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/svg+xml') return 'svg';
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  return 'png';
}

export async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    throw new Error('Format non supporté. Utilisez PNG, JPEG, WebP ou SVG.');
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error('Le logo ne doit pas dépasser 2 Mo.');
  }

  const ext = logoExtension(file);
  const path = `${companyId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(COMPANY_ASSETS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(COMPANY_ASSETS_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  await updateCompanyBranding(companyId, { logo_url: publicUrl });
  return publicUrl;
}

export async function removeCompanyLogo(companyId: string): Promise<void> {
  const { data: files } = await supabase.storage.from(COMPANY_ASSETS_BUCKET).list(companyId);
  if (files?.length) {
    const paths = files.map((f) => `${companyId}/${f.name}`);
    await supabase.storage.from(COMPANY_ASSETS_BUCKET).remove(paths);
  }
  await updateCompanyBranding(companyId, { logo_url: null });
}
