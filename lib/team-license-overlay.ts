import {
  normalizeLicenseValidUntil,
  pickLicenseValidUntilRaw,
} from "@/lib/license-valid-until";
import { supabase } from "@/lib/supabase";

/** Minimal polja za spajanje `user_licenses` u listu tima. */
export type TeamMemberLicenseFields = {
  user_id: string;
  license_valid_until?: string | null;
  license_file_path?: string | null;
  license_number?: string | null;
};

export function withNormalizedTeamLicense<T extends TeamMemberLicenseFields>(m: T): T {
  const raw = pickLicenseValidUntilRaw(m as unknown as Record<string, unknown>);
  return {
    ...m,
    license_valid_until: normalizeLicenseValidUntil(raw ?? "") || null,
  };
}

/** RPC često ne vrati iste kolone kao `user_licenses`; ujednačavamo sa ekranom detalja. */
export async function overlayUserLicensesOnTeam<T extends TeamMemberLicenseFields>(
  members: T[],
): Promise<T[]> {
  const ids = [...new Set(members.map((m) => m.user_id))];
  if (ids.length === 0) return members.map(withNormalizedTeamLicense);

  const { data, error } = await supabase
    .from("user_licenses")
    .select(
      "user_id, valid_until, license_valid_until, license_file_path, license_number",
    )
    .in("user_id", ids);

  if (error || !data?.length) return members.map(withNormalizedTeamLicense);

  const byUser = new Map(
    (data as { user_id: string }[]).map((row) => [row.user_id, row]),
  );

  return members.map((m) => {
    const lic = byUser.get(m.user_id) as
      | {
          valid_until?: string | null;
          license_valid_until?: string | null;
          license_file_path?: string | null;
          license_number?: string | null;
        }
      | undefined;
    if (!lic) return withNormalizedTeamLicense(m);
    return withNormalizedTeamLicense({
      ...m,
      license_file_path: lic.license_file_path ?? m.license_file_path ?? null,
      license_number: lic.license_number ?? m.license_number ?? null,
      license_valid_until:
        lic.license_valid_until ??
        lic.valid_until ??
        m.license_valid_until ??
        null,
    });
  });
}
