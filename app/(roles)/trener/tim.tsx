import { RefreshableScrollView } from "@/components/refreshable-scroll-view";
import { ActionAccentHex } from "@/constants/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useScreenPullRefresh } from "@/contexts/screen-pull-refresh-context";
import { ClubContext, mapRpcClubContext } from "@/lib/club-context";
import {
  fetchTrenerTeamPlayerStats,
  type TrenerTeamPlayerStats,
} from "@/lib/fetch-trener-team-player-stats";
import {
  licenseValidityFromMember,
  normalizeLicenseValidUntil,
} from "@/lib/license-valid-until";
import { personDisplayName } from "@/lib/person-display-name";
import { supabase } from "@/lib/supabase";
import { overlayUserLicensesOnTeam } from "@/lib/team-license-overlay";

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
} & Partial<TrenerTeamPlayerStats>;

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

function pointPct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((100 * part) / total);
}

function TeamPointsBlock({
  s,
  tint,
  blk,
}: {
  s: TrenerTeamPlayerStats;
  tint: string;
  blk: string;
}) {
  const sumPts = s.pointsFrom1 + s.pointsFrom2 + s.pointsFrom3;
  if (s.gamesPlayed <= 0 && sumPts === 0) {
    return (
      <View style={styles.pointsBlockWrap}>
        <View style={styles.statCaptionRow}>
          <MaterialIcons name="trending-up" size={14} color={tint} />
          <Text style={[styles.statCaptionPlain, { color: blk }]}>
            Prosek po meču
          </Text>
        </View>
        <Text
          style={[styles.pointsDash, { color: tint }]}
          accessibilityLabel="Nema poena"
        >
          —
        </Text>
      </View>
    );
  }
  const p1 = pointPct(s.pointsFrom1, sumPts);
  const p2 = pointPct(s.pointsFrom2, sumPts);
  const p3 = pointPct(s.pointsFrom3, sumPts);
  const avgStr = s.avgPointsPerGame.toLocaleString("sr-Latn", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  return (
    <View style={styles.pointsBlockWrap}>
      <View style={styles.statCaptionRow}>
        <MaterialIcons name="trending-up" size={14} color={tint} />
        <Text style={[styles.statCaptionPlain, { color: blk }]}>
          Prosek po meču
        </Text>
      </View>
      <Text style={styles.pointsRichRoot} accessibilityRole="text">
        <Text style={[styles.pointsAvgNum, { color: tint }]}>{avgStr}</Text>
        <Text style={{ color: tint }}> (</Text>
        <Text style={[styles.pointsLabel, { color: blk }]}>+1: </Text>
        <Text style={{ color: tint }}>{p1}%</Text>
        <Text style={[styles.pointsLabel, { color: blk }]}> ; +2: </Text>
        <Text style={{ color: tint }}>{p2}%</Text>
        <Text style={[styles.pointsLabel, { color: blk }]}> ; +3: </Text>
        <Text style={{ color: tint }}>{p3}%)</Text>
      </Text>
    </View>
  );
}

function memberStats(member: TeamMember): TrenerTeamPlayerStats {
  return {
    trainingPresent: member.trainingPresent ?? 0,
    trainingTotal: member.trainingTotal ?? 0,
    gamesPlayed: member.gamesPlayed ?? 0,
    avgPointsPerGame: member.avgPointsPerGame ?? 0,
    pointsFrom1: member.pointsFrom1 ?? 0,
    pointsFrom2: member.pointsFrom2 ?? 0,
    pointsFrom3: member.pointsFrom3 ?? 0,
  };
}

export default function TrenerTimScreen() {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [context, setContext] = useState<ClubContext | null>(null);
  const [players, setPlayers] = useState<TeamMember[]>([]);
  const [trainers, setTrainers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<"igraci" | "treneri">("igraci");
  const [monthlyFee, setMonthlyFee] = useState<number | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data: cidRaw, error: cidErr } = await supabase.rpc(
      "my_trener_or_klub_club_id",
    );
    if (cidErr) {
      setErrorMessage(cidErr.message);
      setContext(null);
      setPlayers([]);
      setTrainers([]);
      setMonthlyFee(null);
      setLoading(false);
      return;
    }
    const trenerClubId =
      typeof cidRaw === "number"
        ? cidRaw
        : cidRaw == null
          ? null
          : Number(cidRaw);
    if (!trenerClubId) {
      setContext(null);
      setPlayers([]);
      setTrainers([]);
      setMonthlyFee(null);
      setLoading(false);
      return;
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "get_klub_team_overview",
      { p_club_id: trenerClubId },
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
      const playerSlice = mergedAll.slice(0, rpcPlayers.length) as TeamMember[];
      const trainerSlice = mergedAll.slice(rpcPlayers.length) as TeamMember[];
      const pStats = await fetchTrenerTeamPlayerStats(
        trenerClubId,
        playerSlice.map((p) => p.user_id),
      );
      setPlayers(
        playerSlice.map((p) => ({
          ...p,
          ...pStats[p.user_id],
        })),
      );
      setTrainers(trainerSlice);
      setLoading(false);
      return;
    }

    const overviewErr = rpcErr?.message ?? null;
    const payloadCtx = rpcData
      ? mapRpcClubContext((rpcData as ClubTeamPayload).context)
      : null;
    if (payloadCtx) setContext(payloadCtx);
    else {
      setContext({
        clubId: trenerClubId,
        clubName: `Klub #${trenerClubId}`,
        leagueId: null,
        leagueName: null,
        regionId: null,
        regionName: null,
        groupId: null,
        groupName: null,
      });
    }

    const { data: memberships, error: mErr } = await supabase
      .from("club_memberships")
      .select("user_id, member_role")
      .eq("club_id", trenerClubId)
      .eq("active", true)
      .in("member_role", ["igrac", "trener"]);

    if (mErr) {
      setErrorMessage([mErr.message, overviewErr].filter(Boolean).join(" — "));
      setPlayers([]);
      setTrainers([]);
      setLoading(false);
      return;
    }

    const userIds = (memberships ?? []).map((row) => row.user_id);
    if (userIds.length === 0) {
      setPlayers([]);
      setTrainers([]);
      if (overviewErr) setErrorMessage(overviewErr);
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
        [
          pRes.error?.message ||
            fRes.error?.message ||
            lRes.error?.message ||
            "Greska.",
          overviewErr,
        ]
          .filter(Boolean)
          .join(" — "),
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
      const licRow = license as
        | {
            valid_until?: string | null;
            license_valid_until?: string | null;
            license_file_path?: string | null;
            license_number?: string | null;
          }
        | undefined;
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

    const pStats = await fetchTrenerTeamPlayerStats(
      trenerClubId,
      mappedPlayers.map((p) => p.user_id),
    );
    setPlayers(
      mappedPlayers.map((p) => ({
        ...p,
        ...pStats[p.user_id],
      })),
    );
    setTrainers(mappedTrainers);
    if (overviewErr) setErrorMessage(overviewErr);
    else setErrorMessage("");
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTeam();
    }, [loadTeam]),
  );

  useScreenPullRefresh(loadTeam);

  const isPaid = (status?: string | null) => {
    if (!status) return false;
    return ["placeno", "paid"].includes(status.toLowerCase());
  };

  const renderMemberCard = (member: TeamMember, showFees: boolean) => {
    const lic = licenseValidityFromMember(
      member as unknown as Record<string, unknown>,
    );
    const s = memberStats(member);

    let feePaid = true;
    let currentDue = 0;
    if (showFees) {
      currentDue = Number(member.current_month_due ?? monthlyFee ?? 0);
      const statusPaid = isPaid(
        member.current_month_status ?? member.fee_status,
      );
      feePaid = statusPaid || currentDue <= 0;
    }

    const presenceText = showFees
      ? `${s.trainingPresent}/${s.trainingTotal}`
      : "—/—";
    const gamesText = showFees ? String(s.gamesPlayed) : "—";
    const tint = colors.tint;
    const blk = colors.text;

    return (
      <ThemedView key={member.user_id} style={styles.card}>
        <Pressable
          onPress={() => {
            const cid = context?.clubId;
            router.push(
              (cid != null
                ? `/trener/korisnik/${member.user_id}?clubId=${cid}`
                : `/trener/korisnik/${member.user_id}`) as never,
            );
          }}
          style={styles.summaryPress}
          accessibilityRole="link"
          accessibilityLabel={`Profil: ${memberDisplayName(member)}`}
        >
          <View style={styles.summaryInner}>
            <View style={styles.summaryRows}>
              <View style={styles.summaryRow}>
                <MaterialIcons
                  name="person"
                  size={24}
                  color={ActionAccentHex}
                />
                <ThemedText
                  type="defaultSemiBold"
                  numberOfLines={1}
                  style={styles.summaryNameFlex}
                >
                  {memberDisplayName(member)}
                </ThemedText>
              </View>
              {showFees ? (
                <View style={styles.summaryRowTri}>
                  <View style={styles.feeThird}>
                    <View style={styles.iconWithMarkBlock}>
                      <MaterialIcons
                        name="attach-money"
                        size={22}
                        color={ActionAccentHex}
                      />
                      {feePaid ? (
                        <MaterialIcons
                          name="check-circle"
                          size={20}
                          color={GREEN_OK}
                        />
                      ) : (
                        <ThemedText
                          numberOfLines={2}
                          style={styles.feeDebtInline}
                        >
                          dug: {currentDue}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                  <View style={styles.pointsTwoThirds}>
                    <TeamPointsBlock s={s} tint={tint} blk={blk} />
                  </View>
                </View>
              ) : null}
              <View style={styles.summaryRowTri}>
                <View style={styles.licThird}>
                  <View style={styles.iconWithMarkBlock}>
                    <MaterialIcons
                      name="badge"
                      size={22}
                      color={ActionAccentHex}
                    />
                    {lic.ok ? (
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color={GREEN_OK}
                        accessibilityLabel="Licenca u redu"
                      />
                    ) : (
                      <ThemedText numberOfLines={2} style={styles.licMsgInline}>
                        {lic.message}
                      </ThemedText>
                    )}
                  </View>
                </View>
                <View style={styles.presenceGamesTwoThirds}>
                  <View style={styles.presenceCell}>
                    <View style={styles.statInlineRow}>
                      <MaterialIcons
                        name="event-available"
                        size={14}
                        color={tint}
                      />
                      <ThemedText
                        style={[styles.statCaptionThemed, { color: blk }]}
                        numberOfLines={1}
                      >
                        Prisustvo{" "}
                      </ThemedText>
                      <ThemedText
                        numberOfLines={1}
                        style={[styles.statOrange, { color: tint }]}
                        accessibilityLabel={`Prisustvo treninzima: ${presenceText}`}
                      >
                        {presenceText}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.gamesCell}>
                    <View style={styles.statInlineRow}>
                      <MaterialIcons
                        name="sports-basketball"
                        size={14}
                        color={tint}
                      />
                      <ThemedText
                        style={[styles.statCaptionThemed, { color: blk }]}
                        numberOfLines={1}
                      >
                        Odigrane{" "}
                      </ThemedText>
                      <ThemedText
                        numberOfLines={1}
                        style={[styles.statOrange, { color: tint }]}
                        accessibilityLabel={`Odigrane utakmice: ${gamesText}`}
                      >
                        {gamesText}
                      </ThemedText>
                    </View>
                  </View>
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
  summaryRowTri: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconWithMarkBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    justifyContent: "flex-start",
    alignSelf: "flex-start",
  },
  feeThird: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  pointsTwoThirds: {
    flex: 2,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  licThird: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  presenceGamesTwoThirds: {
    flex: 2,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    gap: 10,
    alignSelf: "center",
  },
  feeDebtInline: {
    color: RED_BAD,
    fontWeight: "700",
    fontSize: 13,
    flexShrink: 1,
    marginLeft: 2,
  },
  licMsgInline: {
    color: RED_BAD,
    fontWeight: "600",
    fontSize: 12,
    flexShrink: 1,
    marginLeft: 2,
    maxWidth: "100%",
  },
  statCaptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 2,
    width: "100%",
  },
  statInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
    minWidth: 0,
    flexShrink: 1,
  },
  statCaptionPlain: {
    fontSize: 11,
    fontWeight: "600",
  },
  statCaptionThemed: {
    fontSize: 11,
    fontWeight: "600",
  },
  presenceCell: {
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: 0,
    flexShrink: 1,
  },
  gamesCell: {
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: 0,
    flexShrink: 1,
  },
  pointsBlockWrap: {
    width: "100%",
    alignItems: "center",
  },
  pointsRichRoot: {
    textAlign: "center",
    flexWrap: "wrap",
    width: "100%",
  },
  pointsAvgNum: {
    fontSize: 17,
    fontWeight: "800",
  },
  pointsLabel: {
    fontWeight: "700",
    fontSize: 12,
  },
  pointsDash: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    width: "100%",
  },
  statOrange: {
    fontSize: 15,
    fontWeight: "800",
  },
  summaryNameFlex: { flex: 1, minWidth: 0, fontSize: 16 },
  summaryDebtText: {
    color: RED_BAD,
    fontWeight: "600",
    fontSize: 14,
  },
  summaryChevron: { marginTop: 0, flexShrink: 0 },
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
  errorText: { color: "#c53939" },
});
