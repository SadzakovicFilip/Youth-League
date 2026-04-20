export function sanitizeUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

export function usernameToEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (normalized.includes('@')) {
    return normalized;
  }
  const safe = sanitizeUsername(normalized);
  return `${safe}@youthleague.local`;
}
