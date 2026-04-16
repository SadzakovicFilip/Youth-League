export function usernameToEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (normalized.includes('@')) {
    return normalized;
  }
  return `${normalized}@youthleague.local`;
}
