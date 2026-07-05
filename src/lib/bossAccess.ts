import { posteMatches } from '@/lib/userPositions';

export interface BossAccessContext {
  isAdmin: boolean;
  isModerator: boolean;
  userPosition: string;
}

/** Boss / manager dashboard (read-only commercial activity). */
export function canAccessBossDashboard(ctx: BossAccessContext): boolean {
  if (ctx.isAdmin || ctx.isModerator) return true;
  return posteMatches(ctx.userPosition, ['directeur generale', 'responsable commerciale']);
}

/** Auto-redirect after login (DG only — admins keep the full ERP home). */
export function shouldAutoRedirectToBoss(ctx: BossAccessContext): boolean {
  if (ctx.isAdmin || ctx.isModerator) return false;
  return posteMatches(ctx.userPosition, ['directeur generale']);
}

export function getUserPositionFromMetadata(
  user: { user_metadata?: Record<string, unknown> } | null | undefined
): string {
  const raw = user?.user_metadata?.position ?? user?.user_metadata?.role;
  return typeof raw === 'string' ? raw.trim() : '';
}
