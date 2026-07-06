export const RH_INCIDENT_TYPES = [
  { id: 'dormir', label: 'Dormir' },
  { id: 'probleme_technique', label: 'Problème technique' },
  { id: 'absence', label: 'Absence' },
  { id: 'accident', label: 'Accident' },
  { id: 'retard_prise_service', label: 'Retard de prise en service' },
  { id: 'non_respect_tenu', label: 'Non respect de la tenue' },
] as const;

export type RhIncidentTypeId = (typeof RH_INCIDENT_TYPES)[number]['id'];

export const RH_REPORT_KINDS = [
  { id: 'controle_site', label: 'Rapport de contrôle de site' },
  { id: 'declaration_incident', label: "Déclaration d'incident" },
  { id: 'accident', label: 'Accident' },
  { id: 'constat', label: 'Constat' },
] as const;

export type RhReportKindId = (typeof RH_REPORT_KINDS)[number]['id'];

export interface RhReportSection {
  title: string;
  content: string;
}

export interface RhVehicleInfo {
  immatriculation: string;
  marque_modele: string;
  conducteur: string;
  description_degats: string;
}

export interface RhSecurityReportForm {
  incidentTypes: RhIncidentTypeId[];
  reportKind: RhReportKindId;
  title: string;
  subtitle: string;
  companyName: string;
  incidentDate: string;
  incidentTime: string;
  location: string;
  incidentTypeDetail: string;
  sections: RhReportSection[];
  vehicleInfo: RhVehicleInfo;
  attachmentFiles: File[];
}

export interface RhSecurityReportRecord {
  id: string;
  incident_types: string[];
  report_kind: string;
  title: string;
  subtitle: string | null;
  company_name: string | null;
  incident_date: string | null;
  location: string | null;
  incident_type_detail: string | null;
  body_sections: RhReportSection[];
  vehicle_info: RhVehicleInfo | null;
  attachment_paths: string[];
  created_by: string | null;
  created_at: string;
  author_name?: string | null;
}

export function rhReportRecordToForm(record: RhSecurityReportRecord): RhSecurityReportForm {
  const defaults = defaultRhReportForm();
  return {
    incidentTypes: record.incident_types.filter((id): id is RhIncidentTypeId =>
      RH_INCIDENT_TYPES.some((t) => t.id === id)
    ),
    reportKind: (RH_REPORT_KINDS.some((k) => k.id === record.report_kind)
      ? record.report_kind
      : 'controle_site') as RhReportKindId,
    title: record.title,
    subtitle: record.subtitle ?? '',
    companyName: record.company_name ?? '',
    incidentDate: record.incident_date ?? '',
    incidentTime: '',
    location: record.location ?? '',
    incidentTypeDetail: record.incident_type_detail ?? '',
    sections: record.body_sections.length > 0 ? record.body_sections : defaults.sections,
    vehicleInfo: record.vehicle_info ?? defaults.vehicleInfo,
    attachmentFiles: [],
  };
}

export const defaultRhReportForm = (): RhSecurityReportForm => ({
  incidentTypes: [],
  reportKind: 'controle_site',
  title: '',
  subtitle: '',
  companyName: '',
  incidentDate: new Date().toISOString().slice(0, 10),
  incidentTime: '',
  location: '',
  incidentTypeDetail: '',
  sections: [
    { title: "1. Objet du rapport", content: '' },
    { title: '2. Description des faits', content: '' },
    { title: '3. Constatations', content: '' },
    { title: '4. Mesures et recommandations', content: '' },
  ],
  vehicleInfo: {
    immatriculation: '',
    marque_modele: '',
    conducteur: '',
    description_degats: '',
  },
  attachmentFiles: [],
});

export function incidentTypeLabels(ids: string[]): string {
  return ids
    .map((id) => RH_INCIDENT_TYPES.find((t) => t.id === id)?.label ?? id)
    .join(', ');
}
