/**
 * PostgREST / JSON često vrate `date` kao pun ISO string.
 * Podržavamo i prikaz DD.MM.GGGG. (srpski) ako negde stigne kao tekst.
 */
export function normalizeLicenseValidUntil(
  raw: string | null | undefined,
): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s || s === "null" || s === "undefined") return "";

  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1];

  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return s;
}

/** Svi mogući ključevi za datum važenja licence u odgovorima RPC / tabele. */
export function pickLicenseValidUntilRaw(
  member: Record<string, unknown>,
): string | null {
  const keys = [
    "license_valid_until",
    "valid_until",
    "licenseValidUntil",
    "expires_at",
    "vazi_do",
    "license_valid_to",
  ] as const;
  for (const k of keys) {
    const v = member[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== "null" && s !== "undefined") return s;
  }
  const nested = member.license;
  if (nested && typeof nested === "object") {
    const n = pickLicenseValidUntilRaw(nested as Record<string, unknown>);
    if (n) return n;
  }
  return null;
}

type LicenseValidityMember = Record<string, unknown>;

/**
 * Sažetak za Tim: isključivo na osnovu datuma važenja (kao polje sa date pickerom).
 * Ne koristi broj licence niti PDF za "nedostaje datum".
 */
export function licenseValidityFromMember(
  member: LicenseValidityMember,
): { ok: boolean; message: string } {
  const raw = pickLicenseValidUntilRaw(member);
  const untilNorm = normalizeLicenseValidUntil(raw);

  let expiryMidnight: Date | null = null;
  if (untilNorm.length >= 10 && /^\d{4}-\d{2}-\d{2}$/.test(untilNorm)) {
    const d = new Date(`${untilNorm}T12:00:00`);
    expiryMidnight = Number.isNaN(d.getTime()) ? null : d;
  } else if (raw?.trim()) {
    const d = new Date(raw.trim());
    expiryMidnight = Number.isNaN(d.getTime()) ? null : d;
  }

  if (expiryMidnight) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const e = new Date(expiryMidnight);
    e.setHours(0, 0, 0, 0);
    if (e < today) return { ok: false, message: "Istekla" };
    return { ok: true, message: "" };
  }

  if (raw?.trim()) return { ok: false, message: "Nevažeći datum" };
  return { ok: false, message: "Bez datuma važenja" };
}
