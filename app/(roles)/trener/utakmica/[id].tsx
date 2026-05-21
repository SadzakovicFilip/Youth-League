import { useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useScreenPullRefresh } from "@/contexts/screen-pull-refresh-context";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { RefreshableScrollView } from "@/components/refreshable-scroll-view";

import { ThemedText } from "@/components/themed-text";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedView } from "@/components/themed-view";
import {
  MatchRichCard,
  type MatchRichTheme,
} from "@/components/shared/match-rich-card";
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/shared/searchable-select";
import { supabase } from "@/lib/supabase";

type MatchInfo = {
  id: number;
  home_club_id: number;
  away_club_id: number;
  scheduled_at: string;
  venue: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  home_score: number | null;
  away_score: number | null;
  home_club_name: string | null;
  away_club_name: string | null;
  side: "home" | "away";
};

type RosterItem = {
  user_id: string;
  jersey_number: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

type PlayerRow = {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  license_valid_until: string | null;
  license_number: string | null;
  is_eligible: boolean;
};

type ObjectionExisting = {
  id: number;
  reason: string;
  created_at: string;
  status?: "pending" | "accepted" | "rejected" | string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolver_display?: string | null;
};

type ObjectionState = {
  is_trener: boolean;
  match_finished: boolean;
  deadline: string | null;
  now: string | null;
  within_window: boolean;
  can_submit: boolean;
  existing: ObjectionExisting | null;
};

type Payload = {
  match: MatchInfo;
  club_id: number;
  can_edit: boolean;
  roster: RosterItem[];
  players: PlayerRow[];
  objection?: ObjectionState | null;
};

const JERSEY_MIN = 4;
const JERSEY_MAX = 16;
const JERSEYS = Array.from(
  { length: JERSEY_MAX - JERSEY_MIN + 1 },
  (_, i) => i + JERSEY_MIN,
);
const MIN_ROSTER = 5;
const MAX_ROSTER = 12;

/** Ista nijansa kao posle zakazivanja utakmice (savez). */
const CELEBRATION_GREEN = "#047857";

function playerName(
  p: Pick<PlayerRow, "display_name" | "first_name" | "last_name" | "username">,
) {
  return (
    p.display_name ||
    [p.first_name, p.last_name].filter(Boolean).join(" ") ||
    p.username ||
    "Bez imena"
  );
}

function formatMatchTimeSr(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("sr-Latn", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function TrenerMatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);
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
  const [saving, setSaving] = useState(false);
  const [saveCelebration, setSaveCelebration] = useState(false);
  const saveSuccessPulse = useRef(new Animated.Value(1)).current;
  const [errorMessage, setErrorMessage] = useState("");
  const [info, setInfo] = useState<Payload | null>(null);

  const [assigned, setAssigned] = useState<Record<number, string | null>>({});

  const [prigovorOpen, setPrigovorOpen] = useState(false);
  const [prigovorText, setPrigovorText] = useState("");
  const [prigovorSaving, setPrigovorSaving] = useState(false);
  const [prigovorError, setPrigovorError] = useState("");
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isFinite(matchId)) {
      setErrorMessage("Neispravan ID utakmice");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage("");
    const { data, error } = await supabase.rpc("get_trener_match_detail", {
      p_match_id: matchId,
      p_club_id: null,
    });
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    const payload = data as Payload;
    setInfo(payload);

    const initial: Record<number, string | null> = {};
    for (const j of JERSEYS) initial[j] = null;
    for (const r of payload.roster ?? []) initial[r.jersey_number] = r.user_id;
    setAssigned(initial);
    setLoading(false);
  }, [matchId]);

  useScreenPullRefresh(load);

  useEffect(() => {
    load();
  }, [load]);

  const clearSaveCelebration = useCallback(() => {
    setSaveCelebration(false);
  }, []);

  useEffect(() => {
    if (!saveCelebration) {
      saveSuccessPulse.setValue(0.88);
      return;
    }
    saveSuccessPulse.setValue(0.78);
    Animated.timing(saveSuccessPulse, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => clearSaveCelebration(), 3000);
    return () => clearTimeout(t);
  }, [saveCelebration, clearSaveCelebration, saveSuccessPulse]);

  useEffect(() => {
    if (!info?.objection?.deadline) return;
    if (info.objection.existing) return;
    if (!info.objection.match_finished) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [
    info?.objection?.deadline,
    info?.objection?.existing,
    info?.objection?.match_finished,
  ]);

  const objectionTimeLeftSec = useMemo(() => {
    void tick;
    const dl = info?.objection?.deadline;
    if (!dl) return 0;
    const ms = new Date(dl).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  }, [info?.objection?.deadline, tick]);

  const formatCountdown = (s: number) => {
    const mm = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const onSubmitPrigovor = async () => {
    if (!info) return;
    const reason = prigovorText.trim();
    if (reason.length < 3) {
      setPrigovorError("Obrazloženje je prekratko (min 3 karaktera).");
      return;
    }
    setPrigovorSaving(true);
    setPrigovorError("");
    const { error } = await supabase.rpc("submit_match_objection", {
      p_match_id: info.match.id,
      p_reason: reason,
    });
    setPrigovorSaving(false);
    if (error) {
      setPrigovorError(error.message);
      return;
    }
    setPrigovorOpen(false);
    setPrigovorText("");
    await load();
  };

  const matchDate = info?.match.scheduled_at
    ? new Date(info.match.scheduled_at)
    : null;

  const assignedUserIds = useMemo(
    () => new Set(Object.values(assigned).filter((v): v is string => !!v)),
    [assigned],
  );

  const filledCount = useMemo(
    () => Object.values(assigned).filter(Boolean).length,
    [assigned],
  );

  const playerSelectOptions: SelectOption[] = useMemo(() => {
    if (!info) return [];
    return info.players.map((p) => ({
      value: p.user_id,
      label: playerName(p),
      sublabel: p.is_eligible
        ? p.license_valid_until
          ? `Licenca važi do ${p.license_valid_until}`
          : undefined
        : "Bez važeće licence za ovu utakmicu",
      ineligible: !p.is_eligible,
    }));
  }, [info]);

  const selectPlayerForJersey = (jersey: number, userId: string) => {
    setAssigned((prev) => {
      const next = { ...prev };
      for (const j of JERSEYS) if (next[j] === userId) next[j] = null;
      next[jersey] = userId;
      return next;
    });
  };

  const clearJersey = (jersey: number) => {
    setAssigned((prev) => ({ ...prev, [jersey]: null }));
  };

  const onSave = async () => {
    if (!info) return;
    const entries = JERSEYS.filter((j) => !!assigned[j]).map((j) => ({
      user_id: assigned[j],
      jersey_number: j,
    }));
    if (entries.length === 0) {
      setErrorMessage("Dodaj bar jednog igrača.");
      return;
    }
    if (entries.length < MIN_ROSTER) {
      setErrorMessage(`Minimum ${MIN_ROSTER} igrača u sastavu.`);
      return;
    }
    if (entries.length > MAX_ROSTER) {
      setErrorMessage(`Maksimalno ${MAX_ROSTER} igrača.`);
      return;
    }
    setSaving(true);
    setErrorMessage("");
    const { error } = await supabase.rpc("save_match_roster", {
      p_match_id: info.match.id,
      p_club_id: info.club_id,
      p_entries: entries,
    });
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
    setSaveCelebration(true);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("sr-Latn");
    } catch {
      return iso;
    }
  };

  const opponentLabel = useMemo(() => {
    if (!info) return "—";
    const m = info.match;
    const raw =
      m.side === "home"
        ? m.away_club_name ?? `#${m.away_club_id}`
        : m.home_club_name ?? `#${m.home_club_id}`;
    return raw?.trim() ? raw.trim() : "—";
  }, [info]);

  const showObjectionCard = useMemo(() => {
    if (!info?.objection) return false;
    return info.objection.match_finished || !!info.objection.existing;
  }, [info?.objection]);

  return (
    <RefreshableScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background },
      ]}>
      {loading ? <ActivityIndicator color={colors.tint} /> : null}
      {errorMessage ? (
        <ThemedView
          style={[
            styles.errorCard,
            { borderColor: colors.danger, backgroundColor: colors.surface },
          ]}>
          <ThemedText style={[styles.errorText, { color: colors.danger }]}>
            {errorMessage}
          </ThemedText>
        </ThemedView>
      ) : null}

      {info ? (
        <>
          <MatchRichCard
            variant="club_upcoming"
            theme={matchRichTheme}
            oppName={opponentLabel}
            scheduledIso={info.match.scheduled_at}
            venue={info.match.venue}
            status={(info.match.status ?? "").trim() || "—"}
            homeScore={info.match.home_score}
            awayScore={info.match.away_score}
            matchTime={formatMatchTimeSr(info.match.scheduled_at)}
            rosterSummary={`Sastav ${filledCount}/${MAX_ROSTER}`}
            rosterNeedsAttention={
              info.can_edit && filledCount < MIN_ROSTER
            }
          />

          <ThemedView
            style={[
              styles.sidePillRow,
              {
                borderColor: colors.borderStrong,
                backgroundColor: colors.surfaceMuted,
              },
            ]}>
            <MaterialIcons
              name={info.match.side === "home" ? "home" : "flight-takeoff"}
              size={20}
              color={colors.tint}
            />
            <ThemedText
              style={[styles.sidePillText, { color: colors.text }]}>
              Tvoj klub:{" "}
              <ThemedText type="defaultSemiBold">
                {info.match.side === "home" ? "DOMAĆIN" : "GOST"}
              </ThemedText>
            </ThemedText>
          </ThemedView>

          {showObjectionCard ? (
            <ThemedView
              style={[
                styles.objectionCard,
                {
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surfaceMuted,
                },
              ]}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                Prigovor na zapisnik
              </ThemedText>
              {info.objection?.existing ? (
                <ThemedView style={styles.objectionDone}>
                  <ThemedText style={{ color: colors.text }}>
                    Prigovor podnet:{" "}
                    {formatDate(info.objection.existing.created_at)}
                  </ThemedText>
                  <ThemedText
                    style={[styles.muted, { color: colors.textSecondary }]}>
                    {info.objection.existing.reason}
                  </ThemedText>
                  {(() => {
                    const st = info.objection?.existing?.status ?? "pending";
                    if (st === "pending") {
                      return (
                        <ThemedText
                          style={[
                            styles.objectionPending,
                            { color: colors.textSecondary },
                          ]}>
                          Odluka delegata: na čekanju.
                        </ThemedText>
                      );
                    }
                    if (st === "accepted") {
                      return (
                        <ThemedView style={styles.objectionDecisionBox}>
                          <ThemedText
                            style={[
                              styles.objectionAccepted,
                              { color: colors.success },
                            ]}>
                            Odluka delegata: USVOJEN prigovor na zapisnik.
                          </ThemedText>
                          {info.objection.existing.resolved_at ? (
                            <ThemedText
                              style={[
                                styles.muted,
                                { color: colors.textSecondary },
                              ]}>
                              Datum odluke:{" "}
                              {formatDate(info.objection.existing.resolved_at)}
                              {info.objection.existing.resolver_display
                                ? ` · ${info.objection.existing.resolver_display}`
                                : ""}
                            </ThemedText>
                          ) : null}
                        </ThemedView>
                      );
                    }
                    return (
                      <ThemedView style={styles.objectionDecisionBox}>
                        <ThemedText
                          style={[
                            styles.objectionRejected,
                            { color: colors.danger },
                          ]}>
                          Odluka delegata: ODBIJEN prigovor na zapisnik.
                        </ThemedText>
                        {info.objection.existing.resolved_at ? (
                          <ThemedText
                            style={[
                              styles.muted,
                              { color: colors.textSecondary },
                            ]}>
                            Datum odluke:{" "}
                            {formatDate(info.objection.existing.resolved_at)}
                            {info.objection.existing.resolver_display
                              ? ` · ${info.objection.existing.resolver_display}`
                              : ""}
                          </ThemedText>
                        ) : null}
                      </ThemedView>
                    );
                  })()}
                </ThemedView>
              ) : info.objection?.match_finished ? (
                info.objection.is_trener ? (
                  info.objection.within_window ? (
                    <>
                      <ThemedText
                        style={[
                          styles.muted,
                          { color: colors.textSecondary },
                        ]}>
                        Rok za prigovor ističe za{" "}
                        {formatCountdown(objectionTimeLeftSec)}.
                      </ThemedText>
                      {!prigovorOpen ? (
                        <Pressable
                          style={[
                            styles.prigovorBtn,
                            { backgroundColor: colors.tint },
                          ]}
                          onPress={() => setPrigovorOpen(true)}
                        >
                          <ThemedText style={styles.prigovorBtnText}>
                            PRIGOVOR
                          </ThemedText>
                        </Pressable>
                      ) : (
                        <ThemedView style={styles.prigovorForm}>
                          <ThemedTextInput
                            style={[
                              styles.prigovorInput,
                              {
                                borderColor: colors.inputBorder,
                                backgroundColor: colors.inputBackground,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Obrazloženje prigovora..."
                            placeholderTextColor={colors.textMuted}
                            value={prigovorText}
                            onChangeText={setPrigovorText}
                            multiline
                            numberOfLines={5}
                            editable={!prigovorSaving}
                          />
                          {prigovorError ? (
                            <ThemedText
                              style={[styles.errorText, { color: colors.danger }]}
                            >
                              {prigovorError}
                            </ThemedText>
                          ) : null}
                          <ThemedView style={styles.prigovorRow}>
                            <Pressable
                              style={[
                                styles.cancelBtn,
                                {
                                  borderColor: colors.borderStrong,
                                  backgroundColor: colors.surface,
                                },
                                prigovorSaving && styles.saveBtnDisabled,
                              ]}
                              onPress={() => {
                                setPrigovorOpen(false);
                                setPrigovorText("");
                                setPrigovorError("");
                              }}
                              disabled={prigovorSaving}
                            >
                              <ThemedText
                                style={[
                                  styles.cancelBtnText,
                                  { color: colors.text },
                                ]}
                              >
                                Odustani
                              </ThemedText>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.submitBtn,
                                { backgroundColor: colors.danger },
                                prigovorSaving && styles.saveBtnDisabled,
                              ]}
                              onPress={onSubmitPrigovor}
                              disabled={prigovorSaving}
                            >
                              {prigovorSaving ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <ThemedText style={styles.submitBtnText}>
                                  POŠALJI PRIGOVOR
                                </ThemedText>
                              )}
                            </Pressable>
                          </ThemedView>
                        </ThemedView>
                      )}
                    </>
                  ) : (
                    <ThemedText
                      style={[styles.muted, { color: colors.textSecondary }]}
                    >
                      Rok od 30 minuta za podnošenje prigovora je istekao.
                      Smatra se da nemate prigovora na zapisnik.
                    </ThemedText>
                  )
                ) : (
                  <ThemedText
                    style={[styles.muted, { color: colors.textSecondary }]}
                  >
                    Samo trener kluba učesnika može da podnese prigovor.
                  </ThemedText>
                )
              ) : null}
            </ThemedView>
          ) : null}

          <ThemedView style={styles.sectionHead}>
            <MaterialIcons name="groups" size={22} color={colors.tint} />
            <ThemedText type="subtitle" style={{ color: colors.text }}>
              Sastav ({filledCount}/{MAX_ROSTER})
            </ThemedText>
          </ThemedView>
          <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>
            Dresovi #{JERSEY_MIN}–#{JERSEY_MAX}. Minimum {MIN_ROSTER}, maksimum{" "}
            {MAX_ROSTER} igrača.
          </ThemedText>
          {!info.can_edit ? (
            <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>
              Utakmica je odigrana ili nemaš dozvolu za izmene — prikaz je samo
              za pregled.
            </ThemedText>
          ) : null}

          {JERSEYS.map((j) => {
            const currentUserId = assigned[j];
            const current = currentUserId
              ? info.players.find((p) => p.user_id === currentUserId)
              : null;
            const disabledForJersey = info.players
              .filter((p) => {
                const uid = p.user_id;
                return assignedUserIds.has(uid) && assigned[j] !== uid;
              })
              .map((p) => p.user_id);

            return (
              <ThemedView
                key={j}
                style={[
                  styles.jerseyRow,
                  {
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surface,
                  },
                ]}>
                <View
                  style={[
                    styles.jerseyBadge,
                    {
                      borderColor: colors.tint,
                      backgroundColor: colors.accentMuted,
                    },
                  ]}
                >
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.jerseyBadgeNum, { color: colors.tint }]}>
                    #{j}
                  </ThemedText>
                </View>

                <View style={styles.jerseySelectCol}>
                  {info.can_edit ? (
                    <SearchableSelect
                      placeholder="Izaberi igrača…"
                      sheetTitle={`Igrač za dres #${j}`}
                      value={assigned[j]}
                      options={playerSelectOptions}
                      disabledValues={disabledForJersey}
                      clearable
                      containerStyle={styles.selectFlex}
                      onChange={(v) => {
                        if (v) selectPlayerForJersey(j, v);
                        else clearJersey(j);
                      }}
                    />
                  ) : (
                    <ThemedView
                      style={[
                        styles.readonlyValue,
                        {
                          borderColor: colors.inputBorder,
                          backgroundColor: colors.inputBackground,
                        },
                      ]}
                    >
                      <ThemedText
                        numberOfLines={2}
                        style={{ color: colors.text }}
                      >
                        {current ? playerName(current) : "—"}
                      </ThemedText>
                    </ThemedView>
                  )}
                </View>
              </ThemedView>
            );
          })}

          {info.can_edit ? (
            <Pressable
              style={[
                styles.saveBtn,
                {
                  backgroundColor: saveCelebration
                    ? CELEBRATION_GREEN
                    : colors.tint,
                },
                saveCelebration && styles.saveBtnCelebration,
                saving && styles.saveBtnDisabled,
              ]}
              onPress={onSave}
              disabled={saving || saveCelebration}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : saveCelebration ? (
                <View style={styles.saveBtnCelebrationRow}>
                  <Animated.View
                    style={{ transform: [{ scale: saveSuccessPulse }] }}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={28}
                      color="#FFFFFF"
                      accessibilityLabel="Sačuvano"
                    />
                  </Animated.View>
                  <ThemedText
                    lightColor="#FFFFFF"
                    darkColor="#FFFFFF"
                    style={styles.saveBtnCelebrationText}
                  >
                    Sačuvan sastav
                  </ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.saveBtnText}>
                  Sačuvaj sastav
                </ThemedText>
              )}
            </Pressable>
          ) : null}

          <ThemedView
            style={[
              styles.legend,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
              },
            ]}
          >
            <ThemedText
              style={[styles.legendLine, { color: colors.textSecondary }]}
            >
              U listi: crveno = nema važeće licence za ovu utakmicu (ne može u
              sastav). „Već izabran“ = dodeljen drugom broju dresa.
            </ThemedText>
            {matchDate ? (
              <ThemedText
                style={[styles.legendLine, { color: colors.textSecondary }]}
              >
                Dan utakmice: {matchDate.toLocaleDateString("sr-Latn")}.
                Licenca mora da važi do ili posle tog datuma.
              </ThemedText>
            ) : null}
          </ThemedView>
        </>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 36 },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { fontWeight: "600" },
  muted: { fontSize: 14, lineHeight: 20 },
  sidePillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sidePillText: { flex: 1, fontSize: 15 },
  objectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  objectionDone: { gap: 6 },
  objectionPending: { marginTop: 4, fontWeight: "600" },
  objectionDecisionBox: { marginTop: 6, gap: 4 },
  objectionAccepted: { fontWeight: "700" },
  objectionRejected: { fontWeight: "700" },
  prigovorBtn: {
    borderRadius: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  prigovorBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 1 },
  prigovorForm: { gap: 8 },
  prigovorInput: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  prigovorRow: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelBtnText: { fontWeight: "600" },
  submitBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "700" },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  jerseyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  jerseyBadge: {
    width: 48,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  jerseyBadgeNum: { fontSize: 16 },
  jerseySelectCol: { flex: 1, minWidth: 0 },
  selectFlex: { flex: 1 },
  readonlyValue: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  saveBtn: {
    marginTop: 8,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnCelebration: {
    paddingHorizontal: 14,
  },
  saveBtnCelebrationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveBtnCelebrationText: {
    fontWeight: "700",
    fontSize: 15,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 0.5 },
  legend: {
    gap: 8,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  legendLine: { fontSize: 13, lineHeight: 19 },
});
