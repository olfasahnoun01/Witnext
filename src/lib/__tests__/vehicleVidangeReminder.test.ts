import { describe, expect, it } from 'vitest';
import {
  computeNextVidangeKm,
  isVidangeKmDue,
  buildVidangeReminderNote,
  buildVehicleReminderRows,
} from '../vehicleReminders';

describe('vehicleVidangeReminder', () => {
  it('computes next vidange km from last service + interval', () => {
    expect(
      computeNextVidangeKm({
        id: 'v1',
        vidange_interval_km: 10000,
        vidange_last_km: 45000,
        kilometrage_actuel: 52000,
      })
    ).toBe(55000);
  });

  it('uses current km as baseline when last vidange km is unset', () => {
    expect(
      computeNextVidangeKm({
        id: 'v1',
        vidange_interval_km: 8000,
        vidange_last_km: null,
        kilometrage_actuel: 12000,
      })
    ).toBe(20000);
  });

  it('returns null when interval is disabled', () => {
    expect(
      computeNextVidangeKm({
        id: 'v1',
        vidange_interval_km: null,
        vidange_last_km: 10000,
        kilometrage_actuel: 50000,
      })
    ).toBeNull();
  });

  it('detects when current km reached vidange threshold', () => {
    expect(
      isVidangeKmDue({
        id: 'v1',
        vidange_interval_km: 10000,
        vidange_last_km: 40000,
        kilometrage_actuel: 50000,
      })
    ).toBe(true);
    expect(
      isVidangeKmDue({
        id: 'v1',
        vidange_interval_km: 10000,
        vidange_last_km: 40000,
        kilometrage_actuel: 49999,
      })
    ).toBe(false);
  });

  it('builds readable vidange note', () => {
    const note = buildVidangeReminderNote(55000, 55200);
    expect(note).toContain('Vidange prévue');
    expect(note).toContain('km');
    expect(note.replace(/\s/g, '')).toContain('55000');
    expect(note.replace(/\s/g, '')).toContain('55200');
  });

  it('includes company_id on calendar reminder rows', () => {
    const rows = buildVehicleReminderRows({
      id: 'v1',
      company_id: 'company-abc',
      assurance_due_date: '2026-12-31',
      assurance_remind_at: '2026-12-01',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].company_id).toBe('company-abc');
    expect(rows[0].reminder_type).toBe('assurance');
  });
});
