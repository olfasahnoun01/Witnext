/** Display label: full name, else email local-part, else fallback. */
export function userDisplayName(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = (fullName ?? '').trim();
  if (name) return name;
  const mail = (email ?? '').trim();
  if (mail) return mail.split('@')[0] || mail;
  return 'Utilisateur';
}

/** One or two initials for avatar fallback. */
export function userInitials(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = (fullName ?? '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }
  const mail = (email ?? '').trim();
  if (mail) return mail.charAt(0).toUpperCase();
  return '?';
}
