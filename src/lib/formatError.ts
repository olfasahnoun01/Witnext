/** Turn unknown thrown values / API errors into a user-readable string. */
export function formatError(err: unknown, fallback = 'Erreur inconnue'): string {
  if (err == null) return fallback;
  if (typeof err === 'string') return err.trim() || fallback;
  if (err instanceof Error) return err.message.trim() || fallback;
  if (typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  try {
    const json = JSON.stringify(err);
    if (json && json !== '{}') return json;
  } catch {
    /* ignore */
  }
  return fallback;
}
