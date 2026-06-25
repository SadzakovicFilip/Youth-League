import { ActionAccentHex } from "@/constants/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { ThemedTextInput } from "@/components/themed-text-input";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useScreenPullRefresh } from "@/contexts/screen-pull-refresh-context";
import {
  ClubContext,
  getMyClubContext,
  mapRpcClubContext,
} from "@/lib/club-context";
import {
  licenseValidityFromMember,
  normalizeLicenseValidUntil,
  pickLicenseValidUntilRaw,
} from "@/lib/license-valid-until";
import { overlayUserLicensesOnTeam, withNormalizedTeamLicense } from "@/lib/team-license-overlay";
import { personDisplayName } from "@/lib/person-display-name";
import { supabase } from "@/lib/supabase";

type TeamMember = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date?: string | null;
  address?: string | null;
  phone?: string | null;
  fee_status?: string | null;
  fee_amount_due?: number | null;
  fee_amount_paid?: number | null;
  fee_period_month?: string | null;
  fee_due_date?: string | null;
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
    club_name: string;
    league_id: number | null;
    league_name: string | null;
    region_id: number | null;
    region_name: string | null;
    group_id: number | null;
    group_name: string | null;
    monthly_fee: number | null;
  } | null;
  players: TeamMember[];
  trainers: TeamMember[];
};

const GREEN_OK = "#2e7d32";
const RED_BAD = "#c62828";

function memberDisplayName(member: TeamMember) {
  return personDisplayName(member);
}

function withNormalizedLicense(m: TeamMember): TeamMember {
  return withNormalizedTeamLicense(m);
}

export default function KlubTimScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [context, setContext] = useState<ClubContext | null>(null);
  const [players, setPlayers] = useState<TeamMember[]>([]);
  const [trainers, setTrainers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<"igraci" | "treneri">("igraci");
  const [monthlyFee, setMonthlyFee] = useState<number | null>(null);
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [feeDialogValue, setFeeDialogValue] = useState("");
  const [feeDialogSaving, setFeeDialogSaving] = useState(false);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "get_klub_team_overview",
      {
        p_club_id: null,
      },
    );

    if (!rpcErr && rpcData) {
      const payload = rpcData as ClubTeamPayload;
      const mappedCtx = mapRpcClubContext(payload.context);
      if (mappedCtx) setContext(mappedCtx);
      setMonthlyFee(payload.context?.monthly_fee ?? null);
      const rpcPlayers = (payload.players ?? []) as TeamMember[];
      const rpcTrainers = (payload.trainers ?? []) as TeamMember[];
      const mergedAll = await overlayUserLicensesOnTeam([
        ...rpcPlayers,
        ...rpcTrainers,
      ]);
      setPlayers(mergedAll.slice(0, rpcPlayers.length));
      setTrainers(mergedAll.slice(rpcPlayers.length));
      setLoading(false);
      return;
    }

    const { data: clubCtx, error: ctxErr } = await getMyClubContext();
    if (ctxErr || !clubCtx) {
      setErrorMessage(ctxErr ?? "Nije pronadjen klub kontekst.");
      setLoading(false);
      return;
    }
    setContext(clubCtx);

    const { data: memberships, error: mErr } = await supabase
      .from("club_memberships")
      .select("user_id, member_role")
      .eq("club_id", clubCtx.clubId)
      .eq("active", true)
      .in("member_role", ["igrac", "trener"]);

    if (mErr) {
      setErrorMessage(mErr.message);
      setLoading(false);
      return;
    }

    const userIds = (memberships ?? []).map((row) => row.user_id);
    if (userIds.length === 0) {
      setPlayers([]);
      setTrainers([]);
      setLoading(false);
      return;
    }

    const [pRes, fRes, lRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, username, display_name, first_name, last_name, birth_date, address, phone",
        )
        .in("id", userIds),
      supabase
        .from("player_fees")
        .select(
          "id, player_id, status, amount_due, amount_paid, period_month, due_date",
        )
        .in(
          "player_id",
          (memberships ?? [])
            .filter((m) => m.member_role === "igrac")
            .map((m) => m.user_id),
        )
        .order("period_month", { ascending: false }),
      supabase
        .from("user_licenses")
        .select(
          "user_id, valid_until, license_valid_until, license_file_path, license_number",
        )
        .in("user_id", userIds),
    ]);

    if (pRes.error || fRes.error || lRes.error) {
      setErrorMessage(
        pRes.error?.message ||
          fRes.error?.message ||
          lRes.error?.message ||
          "Greska.",
      );
      setLoading(false);
      return;
    }

    const profileById = new Map((pRes.data ?? []).map((p) => [p.id, p]));
    type FeeLite = {
      player_id: string;
      status: string | null;
      amount_due: number | null;
      amount_paid: number | null;
      period_month: string | null;
      due_date: string | null;
    };
    const latestFeeByPlayer = new Map<string, FeeLite>();
    for (const fee of fRes.data ?? []) {
      if (!latestFeeByPlayer.has(fee.player_id))
        latestFeeByPlayer.set(fee.player_id, fee);
    }
    const licenseByUser = new Map((lRes.data ?? []).map((l) => [l.user_id, l]));

    const mappedPlayers: TeamMember[] = [];
    const mappedTrainers: TeamMember[] = [];

    for (const member of memberships ?? []) {
      const p = profileById.get(member.user_id);
      const license = licenseByUser.get(member.user_id);
      const licRow = license as {
        valid_until?: string | null;
        license_valid_until?: string | null;
        license_file_path?: string | null;
        license_number?: string | null;
      } | undefined;
      const untilRaw =
        licRow?.license_valid_until ?? licRow?.valid_until ?? null;
      const base: TeamMember = {
        user_id: member.user_id,
        username: p?.username ?? null,
        display_name: p?.display_name ?? null,
        first_name: p?.first_name ?? null,
        last_name: p?.last_name ?? null,
        birth_date: p?.birth_date ?? null,
        address: p?.address ?? null,
        phone: p?.phone ?? null,
        license_valid_until: normalizeLicenseValidUntil(untilRaw) || null,
        license_file_path: licRow?.license_file_path ?? null,
        license_number: licRow?.license_number ?? null,
      };

      if (member.member_role === "igrac") {
        const fee = latestFeeByPlayer.get(member.user_id);
        mappedPlayers.push({
          ...base,
          fee_status: fee?.status ?? null,
          fee_amount_due: fee?.amount_due ?? null,
          fee_amount_paid: fee?.amount_paid ?? null,
          fee_period_month: fee?.period_month ?? null,
          fee_due_date: fee?.due_date ?? null,
        });
      } else {
        mappedTrainers.push(base);
      }
    }

    setPlayers(mappedPlayers);
    setTrainers(mappedTrainers);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTeam();
    }, [loadTeam]),
  );

  useScreenPullRefresh(loadTeam);

  const openFeeDialog = () => {
    setFeeDialogValue(monthlyFee != null ? String(monthlyFee) : "");
    setFeeDialogOpen(true);
  };

  const saveMonthlyFee = async () => {
    const amount = Number(feeDialogValue);
    if (!Number.isFinite(amount) || amount < 0) {
      Alert.alert("Neispravan iznos", "Unesi broj veci ili jednak 0.");
      return;
    }
    setFeeDialogSaving(true);
    const { error } = await supabase.rpc("set_club_monthly_fee", {
      p_amount: amount,
    });
    setFeeDialogSaving(false);
    if (error) {
      Alert.alert("Greska", error.message);
      return;
    }
    setMonthlyFee(amount);
    setFeeDialogOpen(false);
    await loadTeam();
  };

  const isPaid = (status?: string | null) => {
    if (!status) return false;
    return ["placeno", "paid"].includes(status.toLowerCase());
  };

  const renderMemberCard = (member: TeamMember, showFees: boolean) => {
    const lic = licenseValidityFromMember(
      member as unknown as Record<string, unknown>,
    );

    let feePaid = true;
    let currentDue = 0;
    if (showFees) {
      currentDue = Number(member.current_month_due ?? monthlyFee ?? 0);
      const statusPaid = isPaid(
        member.current_month_status ?? member.fee_status,
      );
      feePaid = statusPaid || currentDue <= 0;
    }

    return (
      <ThemedView key={member.user_id} style={styles.card}>
        <Pressable
          onPress={() => {
            const cid = context?.clubId;
            router.push(
              (cid != null
                ? `/klub/korisnik/${member.user_id}?clubId=${cid}`
                : `/klub/korisnik/${member.user_id}`) as never,
            );
          }}
          style={styles.summaryPress}
          accessibilityRole="link"
          accessibilityLabel={`Profil: ${memberDisplayName(member)}`}>
          <View style={styles.summaryInner}>
            <View style={styles.summaryRows}>
              <View style={styles.summaryRow}>
                <MaterialIcons name="person" size={24} color={ActionAccentHex} />
                <ThemedText
                  type="defaultSemiBold"
                  numberOfLines={1}
                  style={styles.summaryNameFlex}>
                  {memberDisplayName(member)}
                </ThemedText>
              </View>
              {showFees ? (
                <View style={styles.summaryRow}>
                  <MaterialIcons
                    name="attach-money"
                    size={22}
                    color={ActionAccentHex}
                  />
                  <View style={styles.summaryStatusFlex}>
                    {feePaid ? (
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color={GREEN_OK}
                      />
                    ) : (
                      <ThemedText style={styles.summaryDebtText}>
                        dug: {currentDue}
                      </ThemedText>
                    )}
                  </View>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <MaterialIcons name="badge" size={22} color={ActionAccentHex} />
                <View style={styles.summaryStatusFlex}>
                  {lic.ok ? (
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color={GREEN_OK}
                    />
                  ) : (
                    <ThemedText style={styles.summaryDebtText}>
                      {lic.message}
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={ActionAccentHex}
              style={styles.summaryChevron}
            />
          </View>
        </Pressable>
      </ThemedView>
    );
  };

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      {!loading && (context != null || monthlyFee != null) ? (
        <ThemedView style={styles.card}>
          <ThemedText>
            Mesecna clanarina:{" "}
            {monthlyFee != null ? `${monthlyFee}` : "nije postavljena"}
          </ThemedText>
          <Pressable style={styles.secondaryButton} onPress={openFeeDialog}>
            <ThemedText style={styles.secondaryButtonText}>
              Postavi mesecnu clanarinu
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}

      <Modal
        visible={feeDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFeeDialogOpen(false)}
      >
        <ThemedView style={styles.modalBackdrop}>
          <ThemedView style={styles.modalCard}>
            <ThemedText type="defaultSemiBold">
              Mesecna clanarina kluba
            </ThemedText>
            <ThemedText>Iznos koji vazi za svakog igraca mesecno.</ThemedText>
            <ThemedTextInput
              value={feeDialogValue}
              onChangeText={setFeeDialogValue}
              placeholder="npr. 2000"
              keyboardType="numeric"
              style={styles.inputSpacing}
            />
            <ThemedView style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setFeeDialogOpen(false)}
                disabled={feeDialogSaving}
              >
                <ThemedText style={styles.secondaryButtonText}>
                  Otkazi
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryButton,
                  feeDialogSaving && styles.buttonDisabled,
                ]}
                onPress={saveMonthlyFee}
                disabled={feeDialogSaving}
              >
                {feeDialogSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>
                    Sacuvaj
                  </ThemedText>
                )}
              </Pressable>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      <ThemedView style={styles.tabRow}>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === "igraci" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("igraci")}
        >
          <ThemedText
            style={
              activeTab === "igraci" ? styles.tabButtonActiveText : undefined
            }
          >
            Igraci ({players.length})
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === "treneri" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("treneri")}
        >
          <ThemedText
            style={
              activeTab === "treneri" ? styles.tabButtonActiveText : undefined
            }
          >
            Treneri ({trainers.length})
          </ThemedText>
        </Pressable>
      </ThemedView>

      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && activeTab === "igraci" && players.length === 0 ? (
        <ThemedText>Nema igraca za prikaz.</ThemedText>
      ) : null}
      {!loading && activeTab === "treneri" && trainers.length === 0 ? (
        <ThemedText>Nema trenera za prikaz.</ThemedText>
      ) : null}

      {!loading && activeTab === "igraci"
        ? players.map((p) => renderMemberCard(p, true))
        : null}
      {!loading && activeTab === "treneri"
        ? trainers.map((t) => renderMemberCard(t, false))
        : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  card: {
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  summaryPress: { borderRadius: 6 },
  summaryInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  summaryRows: { flex: 1, gap: 8, minWidth: 0 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryNameFlex: { flex: 1, minWidth: 0, fontSize: 16 },
  summaryStatusFlex: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  summaryDebtText: {
    color: RED_BAD,
    fontWeight: "600",
    fontSize: 14,
    flex: 1,
  },
  summaryChevron: { marginTop: 0, flexShrink: 0 },
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
  inputSpacing: { marginTop: 4 },
  tabRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tabButton: {
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabButtonActive: {
    backgroundColor: ActionAccentHex,
    borderColor: ActionAccentHex,
  },
  tabButtonActiveText: { color: "#fff", fontWeight: "600" },
  primaryButton: {
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ActionAccentHex,
  },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  secondaryButtonText: { color: ActionAccentHex, fontWeight: "600" },
  buttonDisabled: { opacity: 0.6 },
  errorText: { color: "#c53939" },
});
