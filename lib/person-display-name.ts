/** Ime i prezime ako postoje, inače prikazno ime, pa korisničko ime (bez @). */
export function personDisplayName(p: {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  username?: string | null;
}): string {
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (p.display_name?.trim()) return p.display_name.trim();
  if (p.username?.trim()) return p.username.trim();
  return "Član";
}
