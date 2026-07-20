export function normalizeEmployeeRole(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

export function isDriverEmployeeRole(role?: string | null): boolean {
  const r = normalizeEmployeeRole(role);
  return (
    r.includes('chauffeur') ||
    r.includes('conducteur') ||
    r.includes('driver') ||
    r.includes('operateur') ||
    r.includes('chauffer')
  );
}

export function filterDriverEmployees<T extends { role?: string | null }>(employees: T[]): T[] {
  return employees.filter((emp) => isDriverEmployeeRole(emp.role));
}
