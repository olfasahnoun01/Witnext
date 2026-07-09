import { parsePhoneListFromStorage } from '@/lib/phoneList';

export function partyPhoneToLines(displayOrRaw: string): string[] {
  const trimmed = displayOrRaw.trim();
  if (!trimmed) return [''];
  if (trimmed.includes(' · ')) {
    const parts = trimmed.split(' · ').map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [''];
  }
  const parsed = parsePhoneListFromStorage(trimmed);
  return parsed.length > 0 ? parsed : [trimmed];
}

export function parsePartyAddressFields(address: string): {
  exactLocation: string;
  city: string;
  governorate: string;
} {
  const trimmed = address.trim();
  if (!trimmed) return { exactLocation: '', city: '', governorate: '' };

  const parts = trimmed.split(', ').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      exactLocation: parts.slice(0, -2).join(', '),
      city: parts[parts.length - 2],
      governorate: parts[parts.length - 1],
    };
  }
  if (parts.length === 2) {
    return { exactLocation: '', city: parts[0], governorate: parts[1] };
  }
  return { exactLocation: parts[0], city: '', governorate: '' };
}
