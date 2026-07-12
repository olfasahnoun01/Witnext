/**
 * Codes opérations TEJ (extrait TEJRSCodesOperations_v1.0) + mapping taux UI.
 * Source : cahier des charges TEJ CCT-RS V2 — jibaya.tn.
 */

export const TEJ_SCHEMA_VERSION = '1.0';

/** Valeurs autorisées par TEJRSCodesOperations_v1.0.xsd (CCT-RS V2, pp. 53–56). */
export const TEJ_OPERATION_CODES = {
  RS1_000001: { code: 'RS1_000001', label: "Loyers d'hôtels — résidents régime réel" },
  RS1_000002: { code: 'RS1_000002', label: 'Loyers servis à des résidents établis' },
  RS2_000001: {
    code: 'RS2_000001',
    label: 'Honoraires BNC forfait / commissions (résidents)',
  },
  /** Honoraires BNC régime réel */
  RS2_000002: {
    code: 'RS2_000002',
    label: 'Honoraires BNC régime réel (résidents)',
  },
  RS2_000003: { code: 'RS2_000003', label: 'Rémunérations de performance' },
  RS2_000004: { code: 'RS2_000004', label: 'Artistes, créateurs et droits voisins' },
  RS3_000001: { code: 'RS3_000001', label: 'Revenus de capitaux mobiliers — résidents' },
  RS3_000003: { code: 'RS3_000003', label: 'Capitaux mobiliers — non-résidents hors banques' },
  RS3_000004: { code: 'RS3_000004', label: 'Capitaux mobiliers — banques non établies' },
  RS3_000005: { code: 'RS3_000005', label: 'Capitaux mobiliers — régime fiscal privilégié' },
  RS4_000001: { code: 'RS4_000001', label: 'Cession valeurs mobilières — PM non-résidente' },
  RS4_000002: { code: 'RS4_000002', label: 'Cession valeurs mobilières — PP non-résidente' },
  RS5_000001: { code: 'RS5_000001', label: 'Dividendes — PP résidente' },
  RS5_000002: { code: 'RS5_000002', label: 'Dividendes — non-résidents' },
  RS5_000003: { code: 'RS5_000003', label: 'Dividendes — régime fiscal privilégié' },
  RS6_000001: { code: 'RS6_000001', label: 'Cession de fonds de commerce — résidents' },
  RS6_000002: { code: 'RS6_000002', label: 'Cession immeubles/droits sociaux — résidents' },
  RS6_000003: { code: 'RS6_000003', label: 'Cession immeubles — PP non-résidente' },
  RS6_000005: { code: 'RS6_000005', label: 'Cession immeubles — PM non-résidente' },
  RS7_000001: {
    code: 'RS7_000001',
    label: 'Acquisitions ≥ 1000 DT — IS hors 10 % et 15 %',
  },
  RS7_000002: {
    code: 'RS7_000002',
    label: 'Acquisitions ≥ 1000 DT — IS 15 %',
  },
  RS7_000003: {
    code: 'RS7_000003',
    label: 'Acquisitions ≥ 1000 DT — IS 10 % / déduction 2/3',
  },
  RS7_000004: { code: 'RS7_000004', label: 'Commission télécom — personne physique' },
  RS7_000005: { code: 'RS7_000005', label: 'Commission télécom — personne morale' },
  RS8_000001: { code: 'RS8_000001', label: 'Jetons de présence — résidents' },
  RS8_000002: { code: 'RS8_000002', label: 'Jetons de présence — non-résidents' },
  RS8_000003: { code: 'RS8_000003', label: 'Jetons de présence — régime fiscal privilégié' },
  RS9_000001: { code: 'RS9_000001', label: 'Rémunérations non-résidents non établis' },
  RS9_000002: { code: 'RS9_000002', label: 'Redevances — non-résidents non établis' },
  RS9_000003: { code: 'RS9_000003', label: 'Rémunérations — régime fiscal privilégié' },
  RS9_000004: { code: 'RS9_000004', label: 'Non-résident ≤ 6 mois — construction' },
  RS9_000005: { code: 'RS9_000005', label: 'Non-résident ≤ 6 mois — montage' },
  RS9_000006: { code: 'RS9_000006', label: 'Non-résident ≤ 6 mois — autres services' },
  RS9_000007: { code: 'RS9_000007', label: "Non-résident établi sans déclaration d'existence" },
  RS9_000008: { code: 'RS9_000008', label: 'Non-résident établi — régime fiscal privilégié' },
  RS11_000001: { code: 'RS11_000001', label: 'Jeux de pari, hasard et loterie' },
} as const;

export type TejKnownOperationCode = keyof typeof TEJ_OPERATION_CODES;

const MF_REGEX = /^\d{7}[A-Z]$/;

/** Normalise un MF saisi (espaces, minuscules) vers le format TEJ. */
export function normalizeMatriculeFiscal(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s./-]/g, '').toUpperCase();
  return cleaned || null;
}

export function isValidMatriculeFiscal(raw: string | null | undefined): boolean {
  const mf = normalizeMatriculeFiscal(raw);
  return !!mf && MF_REGEX.test(mf);
}

export function isKnownTejOperationCode(value: string | null | undefined): value is TejKnownOperationCode {
  return !!value && Object.prototype.hasOwnProperty.call(TEJ_OPERATION_CODES, value);
}

const TEJ_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const FORBIDDEN_TEJ_SEQUENCE = /--|\/\*|&#|['"]\s*(?:OR|AND)\b/i;

export function isValidTejEmail(value: string | null | undefined): boolean {
  return !!value && TEJ_EMAIL_REGEX.test(value);
}

/** CCT-RS V2 p.78: caractères spéciaux, commentaires SQL et séquences OR/AND interdits. */
export function hasForbiddenTejText(value: string | null | undefined): boolean {
  return !!value && FORBIDDEN_TEJ_SEQUENCE.test(value);
}

/** Remplace les caractères interdits simples (accents, ;, *, &) sans modifier les données ERP. */
export function sanitizeTejText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[;*&]/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** DT → millimes entiers (TEJ n'accepte pas de décimales). */
export function dtToMillimes(amountDt: number): number {
  return Math.round((Number(amountDt) || 0) * 1000);
}

/** Formate un taux TEJ (ex. 1.5 → "1.50"). */
export function formatTejTaux(taux: number): string {
  return (Number(taux) || 0).toFixed(2);
}

/** YYYY-MM-DD → DD/MM/YYYY */
export function formatTejDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Nom de fichier TEJ : {MF}-{YYYY}-{MM}-{acte}.xml */
export function buildTejFilename(
  matriculeFiscal: string,
  year: number,
  month: number,
  acteDepot: '0' | '1' = '0'
): string {
  const mf = normalizeMatriculeFiscal(matriculeFiscal) ?? matriculeFiscal;
  const mm = String(month).padStart(2, '0');
  return `${mf}-${year}-${mm}-${acteDepot}.xml`;
}
