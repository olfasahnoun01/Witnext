import { describe, expect, it } from 'vitest';
import { userDisplayName, userInitials } from '@/lib/userDisplay';

describe('userDisplay', () => {
  it('userDisplayName prefers full name', () => {
    expect(userDisplayName('Jean Dupont', 'jean@test.com')).toBe('Jean Dupont');
  });

  it('userDisplayName falls back to email local part', () => {
    expect(userDisplayName('', 'jean.dupont@test.com')).toBe('jean.dupont');
  });

  it('userInitials uses first and last name letters', () => {
    expect(userInitials('Jean Dupont', 'j@test.com')).toBe('JD');
  });

  it('userInitials uses single letter for one word', () => {
    expect(userInitials('Jean', 'j@test.com')).toBe('J');
  });

  it('userInitials falls back to email', () => {
    expect(userInitials('', 'admin@test.com')).toBe('A');
  });
});
