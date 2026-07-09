/** Legacy no-op — PostgreSQL is always connected via Supabase. */
export async function initDatabase(): Promise<void> {
  console.log('Connected to PostgreSQL database');
}

/** Legacy no-op — PostgreSQL auto-saves. */
export function saveDatabase(): void {
  // no-op
}
