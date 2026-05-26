import { supabase } from '@/integrations/supabase/client';
import type { RhSecurityReportForm, RhSecurityReportRecord, RhReportSection, RhVehicleInfo } from '@/lib/rhReportTypes';

const BUCKET = 'rh-report-files';

export async function fetchRhSecurityReports(): Promise<RhSecurityReportRecord[]> {
  const { data, error } = await supabase
    .from('rh_security_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[RH] fetch reports:', error.message);
    throw new Error(error.message);
  }

  return (data || []).map(mapRow);
}

function mapRow(row: Record<string, unknown>): RhSecurityReportRecord {
  return {
    id: String(row.id),
    incident_types: (row.incident_types as string[]) || [],
    report_kind: String(row.report_kind || ''),
    title: String(row.title || ''),
    subtitle: row.subtitle != null ? String(row.subtitle) : null,
    company_name: row.company_name != null ? String(row.company_name) : null,
    incident_date: row.incident_date != null ? String(row.incident_date) : null,
    location: row.location != null ? String(row.location) : null,
    incident_type_detail: row.incident_type_detail != null ? String(row.incident_type_detail) : null,
    body_sections: (row.body_sections as RhReportSection[]) || [],
    vehicle_info: (row.vehicle_info as RhVehicleInfo | null) || null,
    attachment_paths: (row.attachment_paths as string[]) || [],
    created_at: String(row.created_at || ''),
  };
}

export async function uploadRhAttachments(files: File[], reportId: string): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const safe = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${reportId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) {
      console.warn('[RH] upload:', error.message);
      continue;
    }
    paths.push(path);
  }
  return paths;
}

export async function saveRhSecurityReport(form: RhSecurityReportForm): Promise<RhSecurityReportRecord> {
  const { data: userData } = await supabase.auth.getUser();

  const insertPayload = {
    incident_types: form.incidentTypes,
    report_kind: form.reportKind,
    title: form.title.trim() || 'Rapport sans titre',
    subtitle: form.subtitle.trim() || null,
    company_name: form.companyName.trim() || null,
    incident_date: form.incidentDate || null,
    location: form.location.trim() || null,
    incident_type_detail: form.incidentTypeDetail.trim() || null,
    body_sections: form.sections,
    vehicle_info: form.incidentTypes.includes('accident') ? form.vehicleInfo : null,
    attachment_paths: [] as string[],
    created_by: userData.user?.id ?? null,
  };

  const { data, error } = await supabase
    .from('rh_security_reports')
    .insert(insertPayload)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Enregistrement impossible');
  }

  let attachment_paths: string[] = [];
  if (form.attachmentFiles.length > 0) {
    attachment_paths = await uploadRhAttachments(form.attachmentFiles, data.id);
    if (attachment_paths.length > 0) {
      await supabase
        .from('rh_security_reports')
        .update({ attachment_paths })
        .eq('id', data.id);
    }
  }

  return mapRow({ ...data, attachment_paths });
}

export async function deleteRhSecurityReport(id: string): Promise<void> {
  const { error } = await supabase.from('rh_security_reports').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
