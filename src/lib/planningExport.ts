/** Parse & analyse JSON exports from the Planning subsection. */

const WORK_SHIFT_CODES = new Set(['J', 'N', 'J-P1', 'J-P2', 'N-P1', 'N-P2']);

export interface ParsedPlanningAgent {
  id: string;
  name: string;
  normalizedName: string;
  workDays: number;
  restDays: number;
  emptyDays: number;
  totalAssignedDays: number;
  isAffected: boolean;
  shiftsByCode: Record<string, number>;
}

export interface ParsedPlanningSnapshot {
  fileId: string;
  fileName: string;
  companyName: string;
  siteName: string;
  periodType: string;
  referenceDate: string;
  periodLabel: string;
  employeeCount: number;
  agents: ParsedPlanningAgent[];
  tauxAffectation: number;
  avgWorkDaysPerAgent: number;
  attendanceRate: number;
  totalWorkDays: number;
}

export interface PlanningPeriodComparison {
  fromLabel: string;
  toLabel: string;
  fromFile: string;
  toFile: string;
  agentsFrom: number;
  agentsTo: number;
  agentsDelta: number;
  agentsDeltaPct: number;
  tauxAffectationFrom: number;
  tauxAffectationTo: number;
  tauxAffectationDelta: number;
  attendanceFrom: number;
  attendanceTo: number;
  attendanceDelta: number;
  recrutement: { name: string }[];
  departs: { name: string }[];
  stables: { name: string }[];
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function normalizeShift(raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw).trim().toUpperCase();
  if (!s) return '';
  if (WORK_SHIFT_CODES.has(s) || s === 'R') return s;
  const last = s.slice(-1);
  if (last === 'J' || last === 'N' || last === 'R') return last;
  return '';
}

function isWorkShift(code: string): boolean {
  return WORK_SHIFT_CODES.has(code);
}

type RawEmployee = { id: string; name: string; shifts: Record<string, string> };

function isLegacyExport(data: unknown): data is {
  meta: { clientName?: string; siteName?: string; startDate: string; endDate?: string };
  dates: { isoDate: string }[];
  agents?: { id: string; name: string; shifts: string[] }[];
  employees?: { id: string; name: string; shifts: string[] }[];
} {
  if (!data || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  const meta = o.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta.startDate !== 'string') return false;
  if (!Array.isArray(o.dates) || o.dates.length === 0) return false;
  const rows = (o.agents ?? o.employees) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

function legacyToEmployees(
  dates: { isoDate: string }[],
  rows: { id: string; name: string; shifts: string[] }[]
): RawEmployee[] {
  return rows.map((a) => {
    const shifts: Record<string, string> = {};
    const n = Math.min(dates.length, a.shifts?.length ?? 0);
    for (let i = 0; i < n; i++) {
      const dk = String(dates[i].isoDate).slice(0, 10);
      shifts[dk] = normalizeShift(a.shifts[i]);
    }
    return {
      id: String(a.id || crypto.randomUUID()),
      name: String(a.name ?? '').trim(),
      shifts,
    };
  });
}

function extractFromModern(data: Record<string, unknown>): {
  companyName: string;
  siteName: string;
  periodType: string;
  referenceDate: string;
  employeeCount: number;
  employees: RawEmployee[];
} {
  const employees = Array.isArray(data.employees) ? (data.employees as RawEmployee[]) : [];
  return {
    companyName: String(data.companyName ?? '').trim(),
    siteName: String(data.siteName ?? '').trim(),
    periodType: String(data.periodType ?? 'monthly'),
    referenceDate: String(data.referenceDate ?? '').slice(0, 10),
    employeeCount: Number(data.employeeCount) || employees.length,
    employees: employees.map((e) => ({
      id: String(e.id || crypto.randomUUID()),
      name: String(e.name ?? '').trim(),
      shifts: Object.fromEntries(
        Object.entries(e.shifts || {}).map(([k, v]) => [k.slice(0, 10), normalizeShift(v)])
      ),
    })),
  };
}

function buildAgent(row: RawEmployee): ParsedPlanningAgent {
  let workDays = 0;
  let restDays = 0;
  let emptyDays = 0;
  const shiftsByCode: Record<string, number> = {};

  for (const code of Object.values(row.shifts)) {
    if (!code) {
      emptyDays++;
      continue;
    }
    shiftsByCode[code] = (shiftsByCode[code] || 0) + 1;
    if (code === 'R') restDays++;
    else if (isWorkShift(code)) workDays++;
    else emptyDays++;
  }

  const totalAssignedDays = workDays + restDays;
  return {
    id: row.id,
    name: row.name || '—',
    normalizedName: normalizeName(row.name || ''),
    workDays,
    restDays,
    emptyDays,
    totalAssignedDays,
    isAffected: workDays > 0,
    shiftsByCode,
  };
}

function computeSnapshotMetrics(agents: ParsedPlanningAgent[]) {
  const count = agents.length;
  const affected = agents.filter((a) => a.isAffected).length;
  const totalWorkDays = agents.reduce((s, a) => s + a.workDays, 0);
  const totalRest = agents.reduce((s, a) => s + a.restDays, 0);
  const tauxAffectation = count > 0 ? (affected / count) * 100 : 0;
  const avgWorkDaysPerAgent = count > 0 ? totalWorkDays / count : 0;
  const attendanceRate =
    totalWorkDays + totalRest > 0 ? (totalWorkDays / (totalWorkDays + totalRest)) * 100 : 0;
  return { tauxAffectation, avgWorkDaysPerAgent, attendanceRate, totalWorkDays };
}

function formatPeriodLabel(referenceDate: string, periodType: string): string {
  if (!referenceDate) return 'Période';
  const d = new Date(referenceDate);
  if (Number.isNaN(d.getTime())) return referenceDate;
  const month = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  if (periodType === 'weekly') {
    return `Semaine du ${d.toLocaleDateString('fr-FR')}`;
  }
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export function parsePlanningExportFile(
  json: unknown,
  fileName: string,
  fileId: string
): ParsedPlanningSnapshot {
  let companyName = '';
  let siteName = '';
  let periodType = 'monthly';
  let referenceDate = '';
  let employeeCount = 0;
  let rawEmployees: RawEmployee[] = [];

  if (isLegacyExport(json)) {
    companyName = String(json.meta.clientName ?? '').trim();
    siteName = String(json.meta.siteName ?? '').trim();
    referenceDate = String(json.meta.startDate).slice(0, 10);
    periodType = 'custom';
    const rows =
      Array.isArray(json.agents) && json.agents.length > 0 ? json.agents : json.employees ?? [];
    rawEmployees = legacyToEmployees(json.dates, rows);
    employeeCount = rawEmployees.length;
  } else if (json && typeof json === 'object') {
    const extracted = extractFromModern(json as Record<string, unknown>);
    companyName = extracted.companyName;
    siteName = extracted.siteName;
    periodType = extracted.periodType;
    referenceDate = extracted.referenceDate;
    employeeCount = extracted.employeeCount;
    rawEmployees = extracted.employees;
  } else {
    throw new Error('Format JSON non reconnu (export Planning attendu)');
  }

  const agents = rawEmployees.map(buildAgent);
  const metrics = computeSnapshotMetrics(agents);

  return {
    fileId,
    fileName,
    companyName,
    siteName,
    periodType,
    referenceDate,
    periodLabel: formatPeriodLabel(referenceDate, periodType),
    employeeCount: employeeCount || agents.length,
    agents,
    ...metrics,
  };
}

export function normalizeMatchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function snapshotMatchesFilter(
  snapshot: ParsedPlanningSnapshot,
  companyFilter: string,
  siteFilter: string
): boolean {
  const c = normalizeMatchText(companyFilter);
  const s = normalizeMatchText(siteFilter);
  const sc = normalizeMatchText(snapshot.companyName);
  const ss = normalizeMatchText(snapshot.siteName);
  if (!c || !s) return false;
  const companyOk = sc.includes(c) || c.includes(sc);
  const siteOk = ss.includes(s) || s.includes(ss);
  return companyOk && siteOk;
}

export function comparePlanningSnapshots(
  earlier: ParsedPlanningSnapshot,
  later: ParsedPlanningSnapshot
): PlanningPeriodComparison {
  const fromNames = new Map<string, string>();
  const toNames = new Map<string, string>();

  for (const a of earlier.agents) {
    if (a.normalizedName) fromNames.set(a.normalizedName, a.name);
  }
  for (const a of later.agents) {
    if (a.normalizedName) toNames.set(a.normalizedName, a.name);
  }

  const recrutement: { name: string }[] = [];
  const departs: { name: string }[] = [];
  const stables: { name: string }[] = [];

  for (const [key, name] of toNames) {
    if (!fromNames.has(key)) recrutement.push({ name });
    else stables.push({ name });
  }
  for (const [key, name] of fromNames) {
    if (!toNames.has(key)) departs.push({ name });
  }

  const agentsFrom = earlier.agents.length;
  const agentsTo = later.agents.length;
  const agentsDelta = agentsTo - agentsFrom;
  const agentsDeltaPct = agentsFrom > 0 ? (agentsDelta / agentsFrom) * 100 : agentsTo > 0 ? 100 : 0;

  return {
    fromLabel: earlier.periodLabel,
    toLabel: later.periodLabel,
    fromFile: earlier.fileName,
    toFile: later.fileName,
    agentsFrom,
    agentsTo,
    agentsDelta,
    agentsDeltaPct,
    tauxAffectationFrom: earlier.tauxAffectation,
    tauxAffectationTo: later.tauxAffectation,
    tauxAffectationDelta: later.tauxAffectation - earlier.tauxAffectation,
    attendanceFrom: earlier.attendanceRate,
    attendanceTo: later.attendanceRate,
    attendanceDelta: later.attendanceRate - earlier.attendanceRate,
    recrutement,
    departs,
    stables,
  };
}

export function compareAllConsecutive(
  snapshots: ParsedPlanningSnapshot[]
): PlanningPeriodComparison[] {
  const sorted = [...snapshots].sort((a, b) =>
    a.referenceDate.localeCompare(b.referenceDate)
  );
  const out: PlanningPeriodComparison[] = [];
  for (let i = 1; i < sorted.length; i++) {
    out.push(comparePlanningSnapshots(sorted[i - 1], sorted[i]));
  }
  return out;
}
