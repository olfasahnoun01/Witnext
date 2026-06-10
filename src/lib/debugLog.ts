/** Optional NDJSON ingest (local debug tooling only). Off by default — avoids console noise. */
const DEBUG_INGEST_ENABLED = import.meta.env.VITE_DEBUG_INGEST === 'true';

export function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string
): void {
  if (!DEBUG_INGEST_ENABLED) return;

  void fetch('http://127.0.0.1:7501/ingest/f757b207-7cdf-4294-a6c8-a9f0349da8a2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7a9a61' },
    body: JSON.stringify({
      sessionId: '7a9a61',
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
