import { ActionAccentHex, ActionAccentWash } from "@/constants/theme";
import { useAppTheme, type AppThemeColors } from "@/contexts/app-theme-context";
import type { ReactNode } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextStyle,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";

type GroupLite = { id: number; name: string };
type LeagueInfo = {
  id: number;
  name: string;
  region_id: number | null;
  region_name: string | null;
};

type StandingsRow = {
  club_id: number;
  club_name: string;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  points_scored: number;
  points_allowed: number;
  point_diff: number;
  table_points: number;
};

type ScorerRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  club_id: number | null;
  club_name: string | null;
  games: number;
  total_points: number;
  avg_points: number;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
};

type StandingsPayload = {
  group: { id: number; name: string; league_id: number; league_name: string };
  clubs: { club_id: number; club_name: string }[];
  standings: StandingsRow[];
};

type ScorersPayload = {
  league_id: number;
  league_name: string | null;
  group_id: number | null;
  top_scorers: ScorerRow[];
};

type OverviewPayload = {
  league: LeagueInfo;
  groups: GroupLite[];
};

export type LeagueCompetitionViewHandle = {
  refresh: () => Promise<void>;
};

export type LeagueCompetitionViewProps = {
  leagueId: number;
  onOpenPlayer?: (userId: string, clubId?: number) => void;
  onOpenClub?: (clubId: number) => void;
  /** Istakni red tabele / strelaca za ovaj klub (npr. ulogovani klub). */
  highlightClubId?: number | null;
  /** If set, only this group is shown (no group tabs, no league-wide scorers). */
  singleGroupId?: number;
  hideTitle?: boolean;
};

type ViewSegment = "tabela" | "strelci_grupe" | "strelci_lige";

const ST_ROW_MIN = 60;
/** Širina kolone statistike — malo šire od 44 da u viewportu bude ~3 vidljiva polja (ne 4). */
const ST_STAT_W = 45;
/** OU, P, IZ, POS, PRI, +/- (PTS je van skrola) */
const ST_STATS_TOTAL_W = ST_STAT_W * 6;

function playerName(
  p: Pick<ScorerRow, "display_name" | "first_name" | "last_name" | "username">,
) {
  return (
    p.display_name ||
    [p.first_name, p.last_name].filter(Boolean).join(" ") ||
    p.username ||
    "—"
  );
}

function rowIsMineClub(
  clubId: number | null | undefined,
  highlightClubId: number | null | undefined,
) {
  return (
    highlightClubId != null &&
    clubId != null &&
    Number(clubId) === Number(highlightClubId)
  );
}

function PremiumTableFrame({
  children,
  colors,
}: {
  children: ReactNode;
  colors: AppThemeColors;
}) {
  return (
    <ThemedView
      style={[
        styles.premiumFrame,
        {
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface ?? colors.card,
        },
      ]}
    >
      <View style={styles.premiumRimStripe} />
      {children}
    </ThemedView>
  );
}

/** # + puno ime kluba fiksno levo; OU…+/- u jednom horizontalnom skrolu; PTS fiksno desno. */
function StandingsTableSplit({
  rows,
  colors,
  onOpenClub,
  highlightClubId,
}: {
  rows: StandingsRow[];
  colors: AppThemeColors;
  onOpenClub?: (clubId: number) => void;
  highlightClubId?: number | null;
}) {
  const open = (clubId: number) => () => onOpenClub?.(clubId);
  const statLabels = ["OU", "P", "IZ", "POS", "PRI", "+/-"] as const;

  return (
    <PremiumTableFrame colors={colors}>
      <View style={styles.stSplitOuter}>
        <View
          style={[
            styles.stLeftCol,
            {
              borderRightWidth: StyleSheet.hairlineWidth,
              borderRightColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.stLeftHead,
              {
                backgroundColor: colors.tableHeaderBackground,
                borderBottomColor: ActionAccentHex,
              },
            ]}
          >
            <ThemedText style={[styles.stHeadHash, { color: colors.text }]}>
              #
            </ThemedText>
            <ThemedText style={[styles.stHeadClubLbl, { color: colors.text }]}>
              KLUB
            </ThemedText>
          </View>
          {rows.map((row, idx) => {
            const mine = rowIsMineClub(row.club_id, highlightClubId);
            const zebra = idx % 2 === 1;
            return (
              <Pressable
                key={row.club_id}
                onPress={open(row.club_id)}
                disabled={!onOpenClub}
                style={[
                  styles.stLeftRow,
                  { borderTopColor: colors.border, minHeight: ST_ROW_MIN },
                  mine ? styles.stMyClubRow : zebra ? { backgroundColor: ActionAccentWash } : null,
                  mine ? styles.stMyClubRowLeft : null,
                ]}
              >
                <View style={styles.rankCell}>
                  <View
                    style={[
                      styles.rankBadge,
                      idx < 3 && {
                        borderColor: ActionAccentHex,
                        backgroundColor: ActionAccentWash,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[styles.dRankTxt, { color: colors.text }]}
                    >
                      {idx + 1}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText
                  style={[styles.stClubName, { color: colors.text }]}
                  numberOfLines={5}
                >
                  {row.club_name}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          nestedScrollEnabled
          style={styles.stMidScroll}
        >
          <View style={{ width: ST_STATS_TOTAL_W }}>
            <View
              style={[
                styles.stStatHeadRow,
                {
                  backgroundColor: colors.tableHeaderBackground,
                  borderBottomColor: ActionAccentHex,
                },
              ]}
            >
              {statLabels.map((l) => (
                <ThemedText
                  key={l}
                  style={[
                    styles.stStatHead,
                    { color: colors.text, width: ST_STAT_W },
                  ]}
                >
                  {l}
                </ThemedText>
              ))}
            </View>
            {rows.map((row, idx) => {
              const mine = rowIsMineClub(row.club_id, highlightClubId);
              const zebra = idx % 2 === 1;
              return (
                <Pressable
                  key={`m-${row.club_id}`}
                  onPress={open(row.club_id)}
                  disabled={!onOpenClub}
                  style={[
                    styles.stStatBodyRow,
                    { borderTopColor: colors.border, minHeight: ST_ROW_MIN },
                    mine ? styles.stMyClubRow : zebra ? { backgroundColor: ActionAccentWash } : null,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.stStatCell,
                      { color: colors.textSecondary, width: ST_STAT_W },
                    ]}
                  >
                    {row.games_played}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.stStatCell,
                      {
                        color: colors.text,
                        width: ST_STAT_W,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {row.wins}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.stStatCell,
                      { color: colors.textSecondary, width: ST_STAT_W },
                    ]}
                  >
                    {row.losses}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.stStatCell,
                      { color: colors.textSecondary, width: ST_STAT_W },
                    ]}
                  >
                    {row.points_scored}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.stStatCell,
                      { color: colors.textSecondary, width: ST_STAT_W },
                    ]}
                  >
                    {row.points_allowed}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.stStatCell,
                      {
                        color: colors.text,
                        width: ST_STAT_W,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {row.point_diff > 0 ? `+${row.point_diff}` : row.point_diff}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View
          style={[
            styles.stRightCol,
            {
              borderLeftWidth: StyleSheet.hairlineWidth,
              borderLeftColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.stPtsHead,
              {
                backgroundColor: colors.tableHeaderBackground,
                borderBottomColor: ActionAccentHex,
              },
            ]}
          >
            <ThemedText
              style={[styles.stPtsHeadTxt, { color: ActionAccentHex }]}
            >
              PTS
            </ThemedText>
          </View>
          {rows.map((row, idx) => {
            const mine = rowIsMineClub(row.club_id, highlightClubId);
            const zebra = idx % 2 === 1;
            return (
              <Pressable
                key={`p-${row.club_id}`}
                onPress={open(row.club_id)}
                disabled={!onOpenClub}
                style={[
                  styles.stPtsRow,
                  { borderTopColor: colors.border, minHeight: ST_ROW_MIN },
                  mine ? styles.stMyClubRow : zebra ? { backgroundColor: ActionAccentWash } : null,
                ]}
              >
                <ThemedText
                  style={[styles.stPtsVal, { color: ActionAccentHex }]}
                >
                  {row.table_points}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ThemedText style={[styles.tableFoot, { color: colors.textMuted }]}>
        P=Pobede · Iz=Porazi · Pos=Postignuto · Pri=Primljeno · +/-=Kos razlika
        · Pts=Bodovi (W=2, L=1) · 🏀
      </ThemedText>
    </PremiumTableFrame>
  );
}

export const LeagueCompetitionView = forwardRef<
  LeagueCompetitionViewHandle,
  LeagueCompetitionViewProps
>(function LeagueCompetitionView(
  { leagueId, onOpenPlayer, onOpenClub, singleGroupId, hideTitle, highlightClubId },
  ref,
) {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    singleGroupId ?? null,
  );
  const [viewSegment, setViewSegment] = useState<ViewSegment>("tabela");
  const [standings, setStandings] = useState<StandingsPayload | null>(null);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [leagueScorers, setLeagueScorers] = useState<ScorersPayload | null>(
    null,
  );
  const [groupScorers, setGroupScorers] = useState<ScorersPayload | null>(null);
  const [scorersLoading, setScorersLoading] = useState(false);

  const viewSegmentRef = useRef(viewSegment);
  viewSegmentRef.current = viewSegment;

  const loadOverview = useCallback(async (): Promise<number | null> => {
    if (!Number.isFinite(leagueId)) {
      setErrorMessage("Neispravan ID lige");
      setLoading(false);
      return null;
    }
    setLoading(true);
    setErrorMessage("");
    const ovRes = await supabase.rpc("get_league_overview", {
      p_league_id: leagueId,
    });
    if (ovRes.error) {
      setErrorMessage(ovRes.error.message);
      setLoading(false);
      return null;
    }
    const ov = (ovRes.data ?? null) as OverviewPayload | null;
    setOverview(ov);
    const lsRes = await supabase.rpc("get_league_top_scorers", {
        p_league_id: leagueId,
        p_group_id: null,
        p_limit: 100,
      });
      if (lsRes.error) {
        setLeagueScorers(null);
      } else {
        setLeagueScorers((lsRes.data ?? null) as ScorersPayload | null);
    }
    const firstGroup = singleGroupId ?? ov?.groups?.[0]?.id ?? null;
    let resolvedGroup: number | null = null;
    setSelectedGroupId((prev) => {
      resolvedGroup = prev ?? firstGroup;
      return resolvedGroup;
    });
    setLoading(false);
    return resolvedGroup;
  }, [leagueId, singleGroupId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const loadGroup = useCallback(
    async (groupId: number) => {
      setStandingsLoading(true);
      setScorersLoading(true);
      const [stRes, scRes] = await Promise.all([
        supabase.rpc("get_group_standings", { p_group_id: groupId }),
        supabase.rpc("get_league_top_scorers", {
          p_league_id: leagueId,
          p_group_id: groupId,
          p_limit: 100,
        }),
      ]);
      if (stRes.error) {
        setErrorMessage(stRes.error.message);
        setStandings(null);
      } else {
        setStandings((stRes.data ?? null) as StandingsPayload | null);
      }
      if (scRes.error) {
        setGroupScorers(null);
      } else {
        setGroupScorers((scRes.data ?? null) as ScorersPayload | null);
      }
      setStandingsLoading(false);
      setScorersLoading(false);
    },
    [leagueId],
  );

  useEffect(() => {
    if (selectedGroupId == null) return;
    if (viewSegment === "strelci_lige") return;
      loadGroup(selectedGroupId);
  }, [selectedGroupId, viewSegment, loadGroup]);

  const groups = overview?.groups ?? [];
  const leagueName = overview?.league?.name ?? "";

  const groupStandings = standings?.standings ?? [];
  const groupScorerList = groupScorers?.top_scorers ?? [];
  const leagueScorerList = leagueScorers?.top_scorers ?? [];

  const showGroupChips = !singleGroupId && groups.length > 0;
  const showViewChips =
    singleGroupId != null || (groups.length > 0 && selectedGroupId != null);
  const segmentBusy =
    viewSegment === "tabela"
      ? standingsLoading
      : viewSegment === "strelci_grupe"
        ? scorersLoading
        : false;

  const chipLabelStyle = (active: boolean): TextStyle => ({
    fontWeight: active ? "800" : "600",
    fontSize: 13,
    letterSpacing: active ? 0.35 : 0.15,
    color: active ? "#fff" : colors.text,
  });

  const refresh = useCallback(async () => {
    const gid = await loadOverview();
    if (gid == null) return;
    if (viewSegmentRef.current !== "strelci_lige") {
      await loadGroup(gid);
    }
  }, [loadOverview, loadGroup]);

  useImperativeHandle(ref, () => ({ refresh }), [refresh]);

  return (
    <View style={styles.container}>
      {!hideTitle ? (
        <ThemedText type="title">
          {singleGroupId
            ? "Takmicenje"
            : `Takmicenje — ${leagueName || `Liga #${leagueId}`}`}
        </ThemedText>
      ) : null}

      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !singleGroupId && groups.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema grupa u ligi.</ThemedText>
        </ThemedView>
      ) : null}

      {showGroupChips ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {groups.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => setSelectedGroupId(g.id)}
              style={[
                styles.chip,
                { borderColor: colors.borderStrong },
                selectedGroupId === g.id && styles.chipActive,
              ]}
            >
              <ThemedText style={chipLabelStyle(selectedGroupId === g.id)}>
                {g.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {showViewChips ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowSecondary}
        >
          {(
            [
              { id: "tabela" as const, label: "Tabela" },
              { id: "strelci_grupe" as const, label: "Strelci grupe" },
              { id: "strelci_lige" as const, label: "Strelci lige" },
            ] as const
          ).map((seg) => (
            <Pressable
              key={seg.id}
              onPress={() => setViewSegment(seg.id)}
              style={[
                styles.chip,
                styles.chipWide,
                { borderColor: colors.borderStrong },
                viewSegment === seg.id && styles.chipActive,
              ]}
            >
              <ThemedText style={chipLabelStyle(viewSegment === seg.id)}>
                {seg.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {showViewChips && segmentBusy ? (
        <ActivityIndicator style={styles.segmentLoader} />
      ) : null}

      {showViewChips && viewSegment === "tabela" && selectedGroupId != null ? (
        <>
          {!standingsLoading && groupStandings.length === 0 ? (
            <ThemedView style={styles.card}>
              <ThemedText>Nema odigranih utakmica u grupi.</ThemedText>
            </ThemedView>
          ) : null}
          {groupStandings.length > 0 ? (
            <StandingsTableSplit
              rows={groupStandings}
              colors={colors}
              onOpenClub={onOpenClub}
              highlightClubId={highlightClubId}
            />
          ) : null}
        </>
          ) : null}

      {showViewChips &&
      viewSegment === "strelci_grupe" &&
      selectedGroupId != null ? (
        <>
          {!scorersLoading && groupScorerList.length === 0 ? (
            <ThemedView style={styles.card}>
              <ThemedText>Jos uvek nema zabelezenih poena u grupi.</ThemedText>
            </ThemedView>
          ) : null}
          <ScorerTablePremium
            rows={groupScorerList}
            onOpenPlayer={onOpenPlayer}
            colors={colors}
            highlightClubId={highlightClubId}
          />
        </>
      ) : null}

      {showViewChips && viewSegment === "strelci_lige" ? (
        <>
          {leagueScorerList.length === 0 ? (
            <ThemedView style={styles.card}>
              <ThemedText>Jos uvek nema zabelezenih poena u ligi.</ThemedText>
            </ThemedView>
          ) : (
            <ScorerTablePremium
              rows={leagueScorerList}
              onOpenPlayer={onOpenPlayer}
              colors={colors}
              highlightClubId={highlightClubId}
            />
          )}
        </>
      ) : null}
    </View>
  );
});

function ScorerTablePremium({
  rows,
  onOpenPlayer,
  colors,
  highlightClubId,
}: {
  rows: ScorerRow[];
  onOpenPlayer?: (userId: string, clubId?: number) => void;
  colors: AppThemeColors;
  highlightClubId?: number | null;
}) {
  const top = useMemo(() => rows.slice(0, 100), [rows]);
  if (top.length === 0) return null;
  return (
    <PremiumTableFrame colors={colors}>
      <View
        style={[
          styles.headRow,
          { backgroundColor: colors.tableHeaderBackground },
        ]}
      >
        <ThemedText
          style={[styles.hCell, styles.hRank, { color: colors.text }]}
        >
          #
        </ThemedText>
        <ThemedText
          style={[styles.hCell, styles.hPlayer, { color: colors.text }]}
        >
          IGRAC
        </ThemedText>
        <ThemedText style={[styles.hCell, styles.hNum, { color: colors.text }]}>
          M
        </ThemedText>
        <ThemedText
          style={[styles.hCell, styles.hNum, { color: ActionAccentHex }]}
        >
          PTS
        </ThemedText>
        <ThemedText style={[styles.hCell, styles.hNum, { color: colors.text }]}>
          PRO
        </ThemedText>
      </View>
      {top.map((r, idx) => {
        const mine = rowIsMineClub(r.club_id, highlightClubId);
        const zebra = idx % 2 === 1;
        return (
        <Pressable
          key={r.user_id}
            style={[
              styles.dataRow,
              { borderTopColor: colors.border },
              mine ? styles.stMyClubRow : zebra ? { backgroundColor: ActionAccentWash } : null,
              mine ? styles.stMyClubRowLeft : null,
            ]}
          disabled={!onOpenPlayer}
            onPress={() =>
              onOpenPlayer?.(
                r.user_id,
                r.club_id != null ? Number(r.club_id) : undefined,
              )
            }
          >
            <View style={styles.rankCell}>
              <View
                style={[
                  styles.rankBadge,
                  idx < 3 && {
                    borderColor: ActionAccentHex,
                    backgroundColor: ActionAccentWash,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.dCell,
                    styles.dRankTxt,
                    { color: colors.text },
                  ]}
                >
                  {idx + 1}
                </ThemedText>
              </View>
            </View>
            <View style={styles.dPlayerCol}>
              <ThemedText
                numberOfLines={1}
                style={[
                  styles.dCell,
                  { color: colors.text, fontWeight: "600" },
                ]}
              >
                {playerName(r)}
              </ThemedText>
              {r.club_name ? (
                <ThemedText
                  style={[styles.scorerClub, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {r.club_name}
              </ThemedText>
            ) : null}
          </View>
            <ThemedText
              style={[
                styles.dCell,
                styles.dNum,
                { color: colors.textSecondary },
              ]}
            >
              {r.games}
            </ThemedText>
            <ThemedText
              style={[
                styles.dCell,
                styles.dNum,
                { color: ActionAccentHex, fontWeight: "800" },
              ]}
            >
              {r.total_points}
            </ThemedText>
            <ThemedText
              style={[
                styles.dCell,
                styles.dNum,
                { color: colors.textSecondary },
              ]}
            >
              {r.avg_points}
            </ThemedText>
        </Pressable>
        );
      })}
      <ThemedText style={[styles.tableFoot, { color: colors.textMuted }]}>
        M=Odigrano · Pts=Poeni · Pro=Prosek · 🏀
      </ThemedText>
    </PremiumTableFrame>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  card: {
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: "#c53939",
    borderRadius: 8,
    padding: 10,
  },
  errorText: { color: "#c53939" },
  chipRow: { gap: 8, paddingVertical: 4, paddingRight: 4 },
  chipRowSecondary: {
    gap: 8,
    paddingVertical: 2,
    paddingBottom: 8,
    paddingRight: 4,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipWide: { paddingHorizontal: 16 },
  chipActive: {
    backgroundColor: ActionAccentHex,
    borderColor: ActionAccentHex,
    ...Platform.select({
      ios: {
        shadowColor: ActionAccentHex,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  segmentLoader: { marginVertical: 4 },
  premiumFrame: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  premiumRimStripe: {
    height: 4,
    width: "100%",
    backgroundColor: ActionAccentHex,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: ActionAccentHex,
    gap: 4,
  },
  hCell: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  hRank: { width: 36, textAlign: "center" },
  hClub: { flex: 1, minWidth: 0 },
  hPlayer: { flex: 1, minWidth: 0 },
  hNum: { width: 32, textAlign: "center" },
  hPts: { width: 36, textAlign: "center" },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  rankCell: { width: 36, alignItems: "center", justifyContent: "center" },
  rankBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  dCell: { fontSize: 12 },
  dRankTxt: { fontWeight: "800", fontSize: 12 },
  dClub: { flex: 1, minWidth: 0, fontWeight: "600" },
  dPlayerCol: { flex: 1, minWidth: 0 },
  dNum: { width: 32, textAlign: "center", fontSize: 12 },
  dPts: { width: 36, textAlign: "center", fontWeight: "900", fontSize: 13 },
  tableFoot: { fontSize: 10, padding: 8, lineHeight: 14 },
  scorerClub: { fontSize: 10, marginTop: 1 },
  stSplitOuter: { flexDirection: "row", alignItems: "stretch" },
  /** Odnos levo/sredina ~ pola između starog (2:1 za klub) i proširenog (1:2 za skrol) → ~1:1. */
  stLeftCol: { flex: 1, minWidth: 108, maxWidth: 236, flexShrink: 0 },
  stLeftHead: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 6,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 2,
  },
  stHeadHash: {
    width: 28,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  stHeadClubLbl: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  stLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  /** Istaknut red za ulogovani / izabrani klub (tabela + strelci). */
  stMyClubRow: {
    backgroundColor: "rgba(184, 92, 46, 0.22)",
  },
  stMyClubRowLeft: {
    borderLeftWidth: 4,
    borderLeftColor: ActionAccentHex,
  },
  stClubName: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  stMidScroll: { flex: 1, minWidth: 102, maxWidth: 132 },
  stStatHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingVertical: 8,
    borderBottomWidth: 2,
  },
  stStatHead: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  stStatBodyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stStatCell: { textAlign: "center", fontSize: 12, paddingVertical: 4 },
  stRightCol: { width: 48, flexShrink: 0 },
  stPtsHead: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: 8,
    borderBottomWidth: 2,
  },
  stPtsHeadTxt: { fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  stPtsRow: {
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
  },
  stPtsVal: { fontSize: 14, fontWeight: "900" },
});
