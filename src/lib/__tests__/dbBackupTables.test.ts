import { describe, expect, it } from 'vitest';
import {
  BACKUP_CORE_TABLES,
  BACKUP_EXTENDED_IMPORT_ORDER,
  BACKUP_EXTENDED_TABLES,
  BACKUP_FORMAT_VERSION,
} from '@/lib/dbBackupTables';

describe('dbBackupTables', () => {
  it('uses version 6 with extended modules', () => {
    expect(BACKUP_FORMAT_VERSION).toBe(6);
    expect(BACKUP_EXTENDED_TABLES.some((t) => t.table === 'gallery_items')).toBe(true);
    expect(BACKUP_EXTENDED_TABLES.some((t) => t.table === 'invoices')).toBe(true);
    expect(BACKUP_EXTENDED_TABLES.some((t) => t.table === 'hr_employees')).toBe(true);
  });

  it('keeps core tables for backward compatibility', () => {
    expect(BACKUP_CORE_TABLES).toContain('clients');
    expect(BACKUP_CORE_TABLES).toContain('products');
  });

  it('imports extended tables in registry order', () => {
    expect(BACKUP_EXTENDED_IMPORT_ORDER.length).toBe(BACKUP_EXTENDED_TABLES.length);
    expect(BACKUP_EXTENDED_IMPORT_ORDER[0]).toBe('companies');
  });
});
