import { getActiveCompanyId } from '@/lib/activeCompany';

/** Build `{companyId}/{fileName}` for company-scoped storage objects. */
export function buildCompanyStoragePath(fileName: string, companyId?: string | null): string {
  const cid = companyId ?? getActiveCompanyId();
  if (!cid) {
    throw new Error('Société active introuvable pour le stockage du fichier');
  }
  const safeName = fileName.replace(/^\/+/, '');
  return `${cid}/${safeName}`;
}

/** Candidate storage paths: company-prefixed first, then legacy flat name. */
export function expandStorageDownloadPaths(path: string, companyId?: string | null): string[] {
  const normalized = path.replace(/^\/+/, '');
  const cid = companyId ?? getActiveCompanyId();
  const candidates = new Set<string>();
  if (normalized) candidates.add(normalized);
  if (cid && !normalized.startsWith(`${cid}/`)) {
    candidates.add(`${cid}/${normalized}`);
  }
  const base = normalized.split('/').pop();
  if (base && base !== normalized) candidates.add(base);
  return [...candidates];
}
