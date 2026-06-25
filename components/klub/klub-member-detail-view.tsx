import { ActionAccentHex } from "@/constants/theme";
import { useAppTheme } from "@/contexts/app-theme-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { LicenseValidUntilField } from "@/components/license-valid-until-field";
import { RefreshableScrollView } from "@/components/refreshable-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedView } from "@/components/themed-view";
import type { BreadcrumbItem } from "@/components/savez/savez-breadcrumbs";
import {
  MatchRichCard,
  formatScore,
  playedOutcomeLetter,
  type MatchRichTheme,
} from "@/components/shared/match-rich-card";
import { PlayerStatsSection } from "@/components/shared/player-stats-section";
import { useScreenPullRefresh } from "@/contexts/screen-pull-refresh-context";
import { useHeaderTitleOverrideOptional } from "@/contexts/header-title-override-context";
import { useSyncTakmicenjeDrillChrome } from "@/contexts/takmicenje-drill-chrome-context";
import { ClubContext, mapRpcClubContext } from "@/lib/club-context";
import { normalizeLicenseValidUntil, pickLicenseValidUntilRaw } from "@/lib/license-valid-until";
import { personDisplayName } from "@/lib/person-display-name";
import { openLicensePdf } from "@/lib/license-viewer";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
};

type License = {
  license_number: string | null;
  license_valid_until: string | null;
  license_file_path: string | null;
};

type UserDetailPayload = {
  profile: Profile | null;
  role: string | null;
  can_view_sensitive?: boolean;
  license: License | null;
};

type TeamMember = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  fee_status?: string | null;
  total_unpaid?: number | null;
  current_month_status?: string | null;
  current_month_due?: number | null;
  license_valid_until?: string | null;
  license_file_path?: string | null;
  license_number?: string | null;
};

type ClubTeamPayload = {
  context: {
    club_id: number;
    club_name?: string | null;
    league_id?: number | string | null;
    league_name?: string | null;
    region_id?: number | string | null;
    region_name?: string | null;
    group_id?: number | string | null;
    group_name?: string | null;
    monthly_fee: number | null;
  } | null;
  players: TeamMember[];
  trainers: TeamMember[];
};

type HubPlayed = {
  match_id: number;
  scheduled_at: string;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  side: "home" | "away";
  jersey_number: number | null;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  total_points: number;
  result: string;
};

type HubAgg = {
  games_played: number;
  total_points: number;
  avg_points: number;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  pct_points_ft: number;
  pct_points_2: number;
  pct_points_3: number;
};

type StatsPayload = {
  authorized: boolean;
  played?: HubPlayed[];
  season?: HubAgg;
  career?: HubAgg;
};

type ChipId = "clanarina" | "licenca" | "utakmice" | "statistika";

type LicenseEdit = {
  validUntil: string;
  licenseNumber: string;
  pickedFile: DocumentPicker.DocumentPickerAsset | null;
  saving: boolean;
};

const base64ToArrayBuffer = (base64: string) => {
  const binaryString =
    typeof globalThis.atob === "function"
      ? globalThis.atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

function normalizeMemberFromOverview(m: TeamMember): TeamMember {
  const raw = pickLicenseValidUntilRaw(m as unknown as Record<string, unknown>);
  return {
    ...m,
    license_valid_until: normalizeLicenseValidUntil(raw ?? "") || null,
  };
}

export type KlubMemberDetailViewProps = {
  userId: string;
  /** Tuđi klub: overview i članarina koriste ovaj id; izostavljeno = moj klub (`null` u RPC). */
  overviewClubId?: number;
  /** `false` za delegata na tuđem timu — sakriven tab članarine. */
  canViewMemberFees?: boolean;
  /**
   * Klub gleda člana drugog kluba: samo chipovi Odigrane i Statistika (bez članarine i licence).
   */
  excludeFeeAndLicenseChips?: boolean;
  syncDrillChrome?: boolean;
};

export function KlubMemberDetailView({
  userId,
  overviewClubId,
  canViewMemberFees = true,
  excludeFeeAndLicenseChips = false,
  syncDrillChrome = false,
}: KlubMemberDetailViewProps) {
  const { colors } = useAppTheme();
  const matchRichTheme = useMemo<MatchRichTheme>(
    () => ({
      surfaceMuted: colors.surfaceMuted,
      borderStrong: colors.borderStrong,
      tint: colors.tint,
      text: colors.text,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      danger: colors.danger,
    }),
    [colors],
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [detail, setDetail] = useState<UserDetailPayload | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [clubCtx, setClubCtx] = useState<ClubContext | null>(null);
  const [monthlyFee, setMonthlyFee] = useState<number | null>(null);
  const [memberRow, setMemberRow] = useState<TeamMember | null>(null);

  const [activeChip, setActiveChip] = useState<ChipId>(() => {
    if (excludeFeeAndLicenseChips) return "utakmice";
    return canViewMemberFees ? "clanarina" : "licenca";
  });
  const [payingPlayerId, setPayingPlayerId] = useState<string | null>(null);

  const [licenseEdit, setLicenseEdit] = useState<LicenseEdit>({
    validUntil: "",
    licenseNumber: "",
    pickedFile: null,
    saving: false,
  });

  const [partialDialogOpen, setPartialDialogOpen] = useState(false);
  const [partialDialogValue, setPartialDialogValue] = useState("");
  const [partialDialogSaving, setPartialDialogSaving] = useState(false);
  const [avatarSlotHeight, setAvatarSlotHeight] = useState(140);
  const headerTitleOverride = useHeaderTitleOverrideOptional();
  const isFocused = useIsFocused();

  const role = detail?.role ?? null;
  const isIgrac = role === "igrac";
  const canSensitive = detail?.can_view_sensitive ?? false;
  const p = detail?.profile;
  const lic = detail?.license;

  const displayTitle = useMemo(
    () => (p ? personDisplayName(p) : "Član"),
    [p],
  );

  const canEditLicense = !excludeFeeAndLicenseChips && canViewMemberFees && canSensitive;

  const mergedLicenseNumber = useMemo(
    () => (lic?.license_number ?? memberRow?.license_number ?? "").trim() || null,
    [lic?.license_number, memberRow?.license_number],
  );
  const mergedLicenseUntilRaw =
    lic?.license_valid_until ?? memberRow?.license_valid_until ?? null;
  const mergedLicenseUntil = useMemo(
    () => normalizeLicenseValidUntil(mergedLicenseUntilRaw ?? "") || null,
    [mergedLicenseUntilRaw],
  );
  const mergedLicensePath = useMemo(
    () => (lic?.license_file_path ?? memberRow?.license_file_path ?? "").trim() || null,
    [lic?.license_file_path, memberRow?.license_file_path],
  );

  const chromeItems = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: "Regije", path: "/savez" }];
    const ctx = clubCtx;
    if (ctx?.regionId != null) {
      items.push({
        label: ctx.regionName ?? `Regija #${ctx.regionId}`,
        path: `/savez/regija/${ctx.regionId}`,
      });
    }
    if (ctx?.leagueId != null) {
      items.push({
        label: ctx.leagueName ?? `Liga #${ctx.leagueId}`,
        path: `/savez/liga/${ctx.leagueId}`,
      });
    }
    if (ctx?.groupId != null) {
      items.push({
        label: ctx.groupName ?? `Grupa #${ctx.groupId}`,
        path: `/savez/grupa/${ctx.groupId}`,
      });
    }
    const cid = overviewClubId ?? ctx?.clubId;
    if (cid != null) {
      items.push({
        label: ctx?.clubName ?? `Klub #${cid}`,
        path: `/savez/klub/${cid}`,
      });
    }
    items.push({ label: displayTitle });
    return items;
  }, [clubCtx, displayTitle, overviewClubId]);

  useSyncTakmicenjeDrillChrome(
    syncDrillChrome && Boolean(p) && !loading,
    displayTitle,
    chromeItems,
  );

  useEffect(() => {
    if (excludeFeeAndLicenseChips && (activeChip === "clanarina" || activeChip === "licenca")) {
      setActiveChip("utakmice");
      return;
    }
    if (!canViewMemberFees && activeChip === "clanarina") {
      setActiveChip("licenca");
    }
  }, [canViewMemberFees, activeChip, excludeFeeAndLicenseChips]);

  useEffect(() => {
    if (!headerTitleOverride) return;
    if (!isFocused) {
      headerTitleOverride.setTitle(null);
      return;
    }
    if (p) headerTitleOverride.setTitle(personDisplayName(p));
    else headerTitleOverride.setTitle(null);
  }, [headerTitleOverride, isFocused, p]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErrorMessage("");

    const { data: rpcDetail, error: dErr } = await supabase.rpc("get_user_detail", {
      p_user_id: userId,
    });
    if (dErr) {
      setErrorMessage(dErr.message);
      setDetail(null);
      setStats(null);
      setMemberRow(null);
      setLoading(false);
      return;
    }
    const payload = (rpcDetail ?? null) as UserDetailPayload | null;
    setDetail(payload);

    if (payload?.role === "igrac") {
      const { data: statsData, error: statsErr } = await supabase.rpc("get_user_match_stats", {
        p_user_id: userId,
      });
      if (statsErr) setStats({ authorized: false });
      else setStats((statsData ?? null) as StatsPayload | null);
    } else {
      setStats(null);
    }

    const clubRpcId = overviewClubId != null ? overviewClubId : null;
    const { data: ov, error: ovErr } = await supabase.rpc("get_klub_team_overview", {
      p_club_id: clubRpcId,
    });
    if (!ovErr && ov) {
      const team = ov as ClubTeamPayload;
      const mappedCtx = mapRpcClubContext(team.context as never);
      if (mappedCtx) setClubCtx(mappedCtx);
      setMonthlyFee(team.context?.monthly_fee ?? null);
      const pl = (team.players ?? []).find((x) => x.user_id === userId);
      const tr = (team.trainers ?? []).find((x) => x.user_id === userId);
      const row = pl ?? tr ?? null;
      setMemberRow(row ? normalizeMemberFromOverview(row) : null);
    } else {
      setClubCtx(null);
      setMonthlyFee(null);
      setMemberRow(null);
    }

    setLoading(false);
  }, [userId, overviewClubId]);

  useEffect(() => {
    load();
  }, [load]);

  useScreenPullRefresh(load);

  useEffect(() => {
    const l = detail?.license;
    if (!l) {
      setLicenseEdit((s) => ({
        ...s,
        validUntil: "",
        licenseNumber: "",
        pickedFile: null,
      }));
      return;
    }
    setLicenseEdit((s) => ({
      ...s,
      validUntil: normalizeLicenseValidUntil(l.license_valid_until) || "",
      licenseNumber: l.license_number ?? "",
      pickedFile: null,
    }));
  }, [detail?.license, userId]);

  const licenseBaseline = useMemo(() => {
    const l = detail?.license;
    return {
      number: (l?.license_number ?? "").trim(),
      until: normalizeLicenseValidUntil(l?.license_valid_until ?? "") || "",
    };
  }, [detail?.license]);

  const isLicenseDirty = useMemo(() => {
    if (licenseEdit.pickedFile) return true;
    const num = licenseEdit.licenseNumber.trim();
    const until = normalizeLicenseValidUntil(licenseEdit.validUntil) || "";
    return num !== licenseBaseline.number || until !== licenseBaseline.until;
  }, [
    licenseEdit.licenseNumber,
    licenseEdit.validUntil,
    licenseEdit.pickedFile,
    licenseBaseline,
  ]);

  const isPaid = (status?: string | null) => {
    if (!status) return false;
    return ["placeno", "paid"].includes(status.toLowerCase());
  };

  const markPaid = useCallback(async (playerId: string) => {
    setPayingPlayerId(playerId);
    setErrorMessage("");
    const { error } = await supabase.rpc("mark_player_fee_paid", {
      p_player_id: playerId,
    });
    setPayingPlayerId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
  }, [load]);

  const payFullDebt = useCallback(async (playerId: string) => {
    setPayingPlayerId(playerId);
    setErrorMessage("");
    const { error } = await supabase.rpc("pay_player_debt", {
      p_player_id: playerId,
      p_amount: null,
    });
    setPayingPlayerId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
  }, [load]);

  const savePartialPayment = async () => {
    const amount = Number(partialDialogValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Neispravan iznos", "Unesi broj veci od 0.");
      return;
    }
    setPartialDialogSaving(true);
    const { error } = await supabase.rpc("pay_player_debt", {
      p_player_id: userId,
      p_amount: amount,
    });
    setPartialDialogSaving(false);
    if (error) {
      Alert.alert("Greska", error.message);
      return;
    }
    setPartialDialogOpen(false);
    setPartialDialogValue("");
    await load();
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setLicenseEdit((s) => ({ ...s, pickedFile: result.assets![0] }));
  };

  const saveLicense = async () => {
    if (!isLicenseDirty) return;
    const validUntilRaw = licenseEdit.validUntil?.trim() || null;
    const validUntil =
      validUntilRaw && validUntilRaw.length >= 10
        ? validUntilRaw.slice(0, 10)
        : validUntilRaw;
    const licenseNumber = licenseEdit.licenseNumber?.trim() || null;
    const picked = licenseEdit.pickedFile;

    if (!validUntil && !picked && !licenseNumber) {
      Alert.alert(
        "Nedostaju podaci",
        "Unesi broj licence, datum i/ili izaberi PDF pre snimanja.",
      );
      return;
    }

    setLicenseEdit((s) => ({ ...s, saving: true }));
    setErrorMessage("");

    let finalPath = lic?.license_file_path ?? memberRow?.license_file_path ?? null;
    if (picked) {
      const uploadPath = `${userId}/current.pdf`;
      try {
        const base64 = await FileSystem.readAsStringAsync(picked.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const bytes = base64ToArrayBuffer(base64);
        const { error: uploadErr } = await supabase.storage
          .from("licenses")
          .upload(uploadPath, bytes, {
            contentType: "application/pdf",
            upsert: true,
          });
        if (uploadErr) {
          setErrorMessage(uploadErr.message);
          setLicenseEdit((s) => ({ ...s, saving: false }));
          return;
        }
      } catch (uploadError) {
        const msg =
          uploadError instanceof Error
            ? uploadError.message
            : "Upload nije uspeo.";
        setErrorMessage(msg);
        setLicenseEdit((s) => ({ ...s, saving: false }));
        return;
      }
      finalPath = uploadPath;
    }

    const effectiveLicenseNumber =
      licenseNumber ?? lic?.license_number ?? memberRow?.license_number ?? null;

    const { error: rpcErr } = await supabase.rpc("upsert_user_license", {
      p_user_id: userId,
      p_valid_until: validUntil,
      p_license_file_path: finalPath,
      p_license_number: effectiveLicenseNumber,
    });

    if (rpcErr) {
      const payload: Record<string, unknown> = {
        user_id: userId,
        valid_until: validUntil,
        license_file_path: finalPath,
      };
      if (effectiveLicenseNumber != null)
        payload.license_number = effectiveLicenseNumber;
      const { error: fallbackErr } = await supabase
        .from("user_licenses")
        .upsert(payload, { onConflict: "user_id" });
      if (fallbackErr) {
        setErrorMessage(fallbackErr.message);
        setLicenseEdit((s) => ({ ...s, saving: false }));
        return;
      }
    }

    setLicenseEdit((s) => ({ ...s, saving: false, pickedFile: null }));
    await load();
  };

  const chipLabel = (id: ChipId) => {
    switch (id) {
      case "clanarina":
        return "Clanarina";
      case "licenca":
        return "Licenca";
      case "utakmice":
        return "Odigrane";
      case "statistika":
        return "Statistika";
      default:
        return "";
    }
  };

  const feePanel = useMemo(() => {
    if (!canViewMemberFees) return null;
    if (!isIgrac || !memberRow) {
      return (
        <ThemedView style={styles.card}>
          <ThemedText>
            {isIgrac
              ? "Nema podataka o clanarini za ovog igraca u kontekstu tvog kluba."
              : "Clanarina se prati samo za igrace."}
          </ThemedText>
        </ThemedView>
      );
    }
    const totalUnpaid = Number(memberRow.total_unpaid ?? 0);
    const currentDueInner = Number(
      memberRow.current_month_due ?? monthlyFee ?? 0,
    );
    const statusPaid = isPaid(
      memberRow.current_month_status ?? memberRow.fee_status,
    );
    const currentPaid = statusPaid || currentDueInner <= 0;
    const paying = payingPlayerId === userId;
    return (
      <ThemedView style={[styles.feeBox, currentPaid && styles.feeBoxPaid]}>
        <ThemedText type="defaultSemiBold">Clanarina</ThemedText>
        <ThemedText>
          Mesecna postavka kluba:{" "}
          {monthlyFee != null ? `${monthlyFee}` : "nije postavljena"}
        </ThemedText>
        <ThemedText>
          Trenutni mesec:{" "}
          {currentPaid ? "PLACENO" : `duguje ${currentDueInner}`}
        </ThemedText>
        <ThemedText>Ukupan dug: {totalUnpaid}</ThemedText>
        {!currentPaid ? (
          <Pressable
            style={[styles.primaryButton, paying && styles.buttonDisabled]}
            onPress={() => markPaid(userId)}
            disabled={paying}>
            {paying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                PLATIO (trenutni mesec)
              </ThemedText>
            )}
          </Pressable>
        ) : null}
        {totalUnpaid > 0 ? (
          <>
            <Pressable
              style={[styles.primaryButton, paying && styles.buttonDisabled]}
              onPress={() => payFullDebt(userId)}
              disabled={paying}>
              {paying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>
                  Platio ceo dug
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, paying && styles.buttonDisabled]}
              onPress={() => {
                setPartialDialogValue("");
                setPartialDialogOpen(true);
              }}
              disabled={paying}>
              <ThemedText style={styles.secondaryButtonText}>
                Platio deo duga
              </ThemedText>
            </Pressable>
          </>
        ) : null}
      </ThemedView>
    );
  }, [
    isIgrac,
    memberRow,
    monthlyFee,
    payingPlayerId,
    userId,
    markPaid,
    payFullDebt,
    canViewMemberFees,
  ]);

  const hasStoredLicensePdf = Boolean(mergedLicensePath);

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && p ? (
        <>
          <ThemedView style={[styles.card, styles.profileCard, { borderColor: colors.borderStrong }]}>
            <View style={styles.profileRow}>
              <View
                style={styles.avatarCol}
                onLayout={(e) => setAvatarSlotHeight(e.nativeEvent.layout.height)}>
                <MaterialIcons
                  name="person"
                  size={Math.min(Math.max(Math.round(avatarSlotHeight * 0.85), 52), 140)}
                  color={colors.tint}
                />
              </View>
              <View style={styles.profileData}>
                <ThemedText type="subtitle" style={{ color: colors.text }}>
                  {displayTitle}
                </ThemedText>
                <ThemedText style={[styles.rolePillText, { color: colors.textSecondary }]}>
                  {role === "igrac" ? "Igrač" : role === "trener" ? "Trener" : role ?? "Član"}
                </ThemedText>
                <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
                  @{p.username ?? "—"}
                </ThemedText>
                <ThemedText style={{ color: colors.text }}>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.textSecondary }}>
                    Ime:{" "}
                  </ThemedText>
                  {p.first_name?.trim() ? p.first_name.trim() : "—"}
                </ThemedText>
                <ThemedText style={{ color: colors.text }}>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.textSecondary }}>
                    Prezime:{" "}
                  </ThemedText>
                  {p.last_name?.trim() ? p.last_name.trim() : "—"}
                </ThemedText>
                {canSensitive ? (
                  <>
                    <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
                      Rođ.: {p.birth_date ?? "—"}
                    </ThemedText>
                    <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {p.address ?? "—"}
                    </ThemedText>
                    <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
                      Tel. {p.phone ?? "—"}
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText style={[styles.muted, { color: colors.textMuted }]}>
                    Osetljivi podaci nisu dostupni u ovom pregledu.
                  </ThemedText>
                )}
                {clubCtx ? (
                  <ThemedText style={[styles.metaClub, { color: colors.textSecondary }]}>
                    {clubCtx.clubName}
                    {clubCtx.leagueName ? ` · ${clubCtx.leagueName}` : ""}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          </ThemedView>

          <View style={styles.chipRow}>
            {(excludeFeeAndLicenseChips
              ? (["utakmice", "statistika"] as const)
              : canViewMemberFees
                ? (["clanarina", "licenca", "utakmice", "statistika"] as const)
                : (["licenca", "utakmice", "statistika"] as const)
            ).map((id) => (
              <Pressable
                key={id}
                style={[
                  styles.chipFilled,
                  {
                    backgroundColor: activeChip === id ? ActionAccentHex : colors.surfaceMuted,
                    borderColor: activeChip === id ? ActionAccentHex : colors.borderStrong,
                  },
                ]}
                onPress={() => setActiveChip(id)}>
                <ThemedText
                  type="defaultSemiBold"
                  style={{
                    color: activeChip === id ? "#fff" : colors.text,
                    fontSize: 11,
                    letterSpacing: 0.15,
                    textAlign: "center",
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}>
                  {chipLabel(id)}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {activeChip === "clanarina" ? feePanel : null}

          {activeChip === "licenca" ? (
            canEditLicense ? (
              <ThemedView style={[styles.card, { borderColor: colors.borderStrong, gap: 12 }]}>
                <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                  Licenca
                </ThemedText>
                <ThemedText style={[styles.fieldHint, { color: colors.textSecondary }]}>
                  Broj licence
                </ThemedText>
                <ThemedTextInput
                  value={licenseEdit.licenseNumber}
                  onChangeText={(t) => setLicenseEdit((s) => ({ ...s, licenseNumber: t }))}
                  placeholder="Broj licence"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.licenseInput,
                    {
                      color: colors.text,
                      borderColor: colors.inputBorder,
                      backgroundColor: colors.inputBackground,
                    },
                  ]}
                />
                <LicenseValidUntilField
                  value={licenseEdit.validUntil}
                  onChange={(t) => setLicenseEdit((s) => ({ ...s, validUntil: t }))}
                  style={styles.inputSpacing}
                />
                {hasStoredLicensePdf ? (
                  <Pressable
                    style={styles.filledButton}
                    onPress={() => mergedLicensePath && openLicensePdf(mergedLicensePath)}>
                    <View style={styles.filledButtonInner}>
                      <MaterialIcons name="picture-as-pdf" size={18} color="#fff" />
                      <ThemedText style={styles.filledButtonText}>Otvori PDF</ThemedText>
                    </View>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.filledButtonMuted, { borderColor: colors.tint }]}
                  onPress={pickPdf}>
                  <View style={styles.filledButtonInner}>
                    <MaterialIcons name="upload-file" size={18} color={colors.tint} />
                    <ThemedText style={[styles.filledButtonMutedText, { color: colors.tint }]}>
                      {hasStoredLicensePdf ? "Izmeni PDF" : "Dodaj PDF"}
                    </ThemedText>
                  </View>
                </Pressable>
                {licenseEdit.pickedFile ? (
                  <ThemedText style={[styles.pickedFileHint, { color: colors.textSecondary }]}>
                    Nova datoteka: {licenseEdit.pickedFile.name}
                  </ThemedText>
                ) : null}
                <Pressable
                  style={[
                    styles.primaryButton,
                    (!isLicenseDirty || licenseEdit.saving) && styles.buttonDisabled,
                  ]}
                  onPress={saveLicense}
                  disabled={!isLicenseDirty || licenseEdit.saving}>
                  {licenseEdit.saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Sačuvaj licencu</ThemedText>
                  )}
                </Pressable>
              </ThemedView>
            ) : (
              <ThemedView style={[styles.card, { borderColor: colors.borderStrong, gap: 10 }]}>
                <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                  Licenca
                </ThemedText>
                <ThemedText style={{ color: colors.text }}>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.textSecondary }}>
                    Broj:{" "}
                  </ThemedText>
                  {mergedLicenseNumber ?? "—"}
                </ThemedText>
                <ThemedText style={{ color: colors.text }}>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.textSecondary }}>
                    Važi do:{" "}
                  </ThemedText>
                  {mergedLicenseUntil ?? "—"}
                </ThemedText>
                {mergedLicensePath ? (
                  <Pressable style={styles.filledButton} onPress={() => openLicensePdf(mergedLicensePath)}>
                    <View style={styles.filledButtonInner}>
                      <MaterialIcons name="picture-as-pdf" size={18} color="#fff" />
                      <ThemedText style={styles.filledButtonText}>Otvori PDF</ThemedText>
                    </View>
                  </Pressable>
                ) : (
                  <ThemedText style={[styles.muted, { color: colors.textMuted }]}>
                    PDF licenca nije uploadovana.
                  </ThemedText>
                )}
              </ThemedView>
            )
          ) : null}

          {activeChip === "utakmice" ? (
            isIgrac && stats?.authorized ? (
              <View style={styles.playedSection}>
                {(stats.played ?? []).length === 0 ? (
                  <ThemedText style={{ color: colors.textSecondary }}>Nema odigranih utakmica.</ThemedText>
                ) : (
                  (stats.played ?? []).map((m) => {
                    const opp =
                      m.side === "home" ? (m.away_club_name ?? "—") : (m.home_club_name ?? "—");
                    const scoreLine = formatScore(m.home_score, m.away_score);
                    const jersey =
                      m.jersey_number != null ? `#${m.jersey_number}` : "—";
                    const outcome = playedOutcomeLetter(
                      m.side,
                      m.home_score,
                      m.away_score,
                      m.result,
                    );
                    return (
                      <MatchRichCard
                        key={m.match_id}
                        variant="player_played"
                        theme={matchRichTheme}
                        oppName={opp}
                        scheduledIso={m.scheduled_at}
                        jersey={jersey}
                        scoreLine={scoreLine}
                        outcome={outcome}
                        total_points={m.total_points}
                        pts_ft={m.pts_ft}
                        pts_2={m.pts_2}
                        pts_3={m.pts_3}
                        fouls={m.fouls}
                      />
                    );
                  })
                )}
              </View>
            ) : (
              <ThemedView style={[styles.card, { borderColor: colors.borderStrong }]}>
                <ThemedText style={[styles.muted, { color: colors.textMuted }]}>
                  {isIgrac
                    ? "Odigrane utakmice nisu dostupne (niste u istoj ligi / nemate ulogu)."
                    : "Lista utakmica je dostupna za igrače."}
                </ThemedText>
              </ThemedView>
            )
          ) : null}

          {activeChip === "statistika" ? (
            isIgrac && stats?.authorized ? (
              <PlayerStatsSection season={stats.season} career={stats.career} />
            ) : (
              <ThemedView style={[styles.card, { borderColor: colors.borderStrong }]}>
                <ThemedText style={[styles.muted, { color: colors.textMuted }]}>
                  {isIgrac
                    ? "Statistika nije dostupna (niste u istoj ligi / nemate ulogu)."
                    : "Agregatna statistika je za sada vezana za igrače."}
                </ThemedText>
              </ThemedView>
            )
          ) : null}
        </>
      ) : null}

      <Modal
        visible={partialDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPartialDialogOpen(false)}>
        <ThemedView style={styles.modalBackdrop}>
          <ThemedView style={styles.modalCard}>
            <ThemedText type="defaultSemiBold">Delimicna uplata duga</ThemedText>
            <ThemedText>Iznos se oduzima od najstarijih dugovanja.</ThemedText>
            <ThemedTextInput
              value={partialDialogValue}
              onChangeText={setPartialDialogValue}
              placeholder="npr. 500"
              keyboardType="numeric"
              style={styles.inputSpacing}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setPartialDialogOpen(false)}
                disabled={partialDialogSaving}>
                <ThemedText style={styles.secondaryButtonText}>Otkazi</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryButton,
                  partialDialogSaving && styles.buttonDisabled,
                ]}
                onPress={savePartialPayment}
                disabled={partialDialogSaving}>
                {partialDialogSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Sacuvaj</ThemedText>
                )}
              </Pressable>
            </View>
          </ThemedView>
        </ThemedView>
      </Modal>
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 32 },
  card: {
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  profileCard: { paddingVertical: 12 },
  profileRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "stretch",
  },
  avatarCol: {
    width: 112,
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
  },
  profileData: { flex: 1, gap: 6, minWidth: 0 },
  rolePillText: { fontSize: 13, fontWeight: "600" },
  metaClub: { marginTop: 4, fontSize: 12 },
  chipRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: 8,
  },
  chipFilled: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 38,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  feeBox: {
    borderWidth: 1,
    borderColor: "#aaa",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  feeBoxPaid: { borderColor: "#2e7d32", backgroundColor: "#e8f5e9" },
  fieldHint: { fontSize: 12, marginBottom: -2 },
  licenseInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  filledButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: ActionAccentHex,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  filledButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filledButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  filledButtonMuted: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    backgroundColor: "transparent",
  },
  filledButtonMutedText: { fontWeight: "600", fontSize: 15 },
  pickedFileHint: { fontSize: 12, fontStyle: "italic" },
  playedSection: { gap: 10 },
  muted: { fontStyle: "italic" },
  errorText: { color: "#c53939" },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ActionAccentHex,
  },
  primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  secondaryButtonText: { color: ActionAccentHex, fontWeight: "600" },
  buttonDisabled: { opacity: 0.45 },
  inputSpacing: { marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 10,
    padding: 16,
    gap: 10,
    backgroundColor: "#fff",
  },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
});
