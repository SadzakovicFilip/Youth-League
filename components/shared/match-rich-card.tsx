import { ActionAccentHex } from "@/constants/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ThemedText } from "@/components/themed-text";

export function formatMatchDateDdMmYyyy(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatScore(h: number | null, a: number | null): string {
  if (h == null || a == null) return "— : —";
  return `${h} : ${a}`;
}

export function ptsDisplay(n: number): string {
  return n > 0 ? String(n) : "/";
}

export function playedOutcomeLetter(
  side: "home" | "away",
  homeScore: number | null,
  awayScore: number | null,
  result?: string | null,
): "W" | "L" | null {
  const hs = homeScore;
  const as = awayScore;
  if (hs != null && as != null) {
    const mine = side === "home" ? hs : as;
    const theirs = side === "home" ? as : hs;
    if (mine > theirs) return "W";
    if (mine < theirs) return "L";
    return null;
  }
  const r = (result ?? "").trim().toUpperCase();
  if (["W", "WIN", "POBEDA", "P"].includes(r)) return "W";
  if (["L", "LOSS", "PORAZ", "I"].includes(r)) return "L";
  return null;
}

export type MatchRichTheme = {
  surfaceMuted: string;
  borderStrong: string;
  tint: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  danger: string;
};

type Base = {
  theme: MatchRichTheme;
  oppName: string;
  scheduledIso: string;
  /** Kada je postavljeno, cela kartica je klikabilna. */
  onPress?: () => void;
};

export type MatchRichCardProps =
  | (Base & {
      variant: "player_played";
      jersey: string;
      scoreLine: string;
      outcome: "W" | "L" | null;
      total_points: number;
      pts_ft: number;
      pts_2: number;
      pts_3: number;
      fouls: number;
    })
  | (Base & {
      variant: "club_played";
      scoreLine: string;
      outcome: "W" | "L" | null;
    })
  | (Base & {
      variant: "club_upcoming";
      venue: string | null;
      status: string;
      homeScore: number | null;
      awayScore: number | null;
      /** Vreme početka (npr. 18:30) — jedna kartica sa ostalim podacima. */
      matchTime?: string | null;
      /** Npr. "Sastav 10/12" */
      rosterSummary?: string | null;
      rosterNeedsAttention?: boolean;
    });

export function MatchRichCard(props: MatchRichCardProps) {
  const { theme, oppName, scheduledIso, onPress } = props;
  const dateStr = formatMatchDateDdMmYyyy(scheduledIso);
  const [shellH, setShellH] = useState(96);
  const watermarkSize = useMemo(
    () => Math.round(Math.max(44, Math.min(160, shellH * 0.72))),
    [shellH],
  );

  const shell = (
    <View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - shellH) > 1) setShellH(h);
      }}
      style={[
        styles.shell,
        !onPress && styles.shellSpaced,
        { borderColor: theme.borderStrong, backgroundColor: theme.surfaceMuted },
      ]}>
      {props.variant === "player_played" || props.variant === "club_played" ? (
        props.outcome ? (
          <View pointerEvents="none" style={styles.watermarkWrap}>
            <Text
              allowFontScaling={false}
              style={[styles.watermarkLetter, { fontSize: watermarkSize }]}>
              {props.outcome}
            </Text>
          </View>
        ) : null
      ) : null}

      <View style={styles.rowOuter}>
        <View style={[styles.stripe, { backgroundColor: theme.tint }]} />
        <View style={styles.body}>
          <View style={styles.rowBetween}>
            <View style={styles.vsWrap}>
              <MaterialIcons name="sports-basketball" size={18} color={theme.tint} />
              <ThemedText
                type="defaultSemiBold"
                numberOfLines={1}
                style={[styles.vsText, { color: theme.text }]}>
                vs {oppName}
              </ThemedText>
            </View>
            <ThemedText style={[styles.dateTxt, { color: theme.textSecondary }]}>{dateStr}</ThemedText>
          </View>

          {props.variant === "player_played" ? (
            <>
              <View style={styles.rowBetween}>
                <View style={styles.dresRow}>
                  <MaterialIcons name="checkroom" size={16} color={theme.textMuted} />
                  <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>DRES</ThemedText>
                  <ThemedText style={[styles.val, { color: theme.text }]}>{props.jersey}</ThemedText>
                </View>
                <ThemedText style={[styles.val, { color: theme.text }]}>{props.scoreLine}</ThemedText>
              </View>
              <View style={[styles.rowBetween, styles.rowLast]}>
                <View style={[styles.pair, { flex: 1, minWidth: 0 }]}>
                  <MaterialIcons name="emoji-events" size={16} color={theme.tint} />
                  <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>Poeni</ThemedText>
                  <ThemedText style={{ color: theme.text }} numberOfLines={3}>
                    <ThemedText style={[styles.val, { color: theme.text }]}>{props.total_points}</ThemedText>
                    <ThemedText style={[styles.ptsSuf, { color: theme.text }]}>{"  ("}</ThemedText>
                    <ThemedText style={[styles.ptsKind, { color: theme.tint }]}>+1</ThemedText>
                    <ThemedText style={[styles.ptsSep, { color: theme.text }]}>
                      {` : ${ptsDisplay(props.pts_ft)} ; `}
                    </ThemedText>
                    <ThemedText style={[styles.ptsKind, { color: theme.tint }]}>+2</ThemedText>
                    <ThemedText style={[styles.ptsSep, { color: theme.text }]}>
                      {` : ${ptsDisplay(props.pts_2)} ; `}
                    </ThemedText>
                    <ThemedText style={[styles.ptsKind, { color: theme.tint }]}>+3</ThemedText>
                    <ThemedText style={[styles.ptsSep, { color: theme.text }]}>
                      {` : ${ptsDisplay(props.pts_3)})`}
                    </ThemedText>
                  </ThemedText>
                </View>
                <View style={[styles.pair, { alignItems: "flex-end" }]}>
                  <MaterialIcons name="gavel" size={16} color={theme.danger} />
                  <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>Lične greške</ThemedText>
                  <ThemedText style={[styles.val, { color: theme.danger }]}>{props.fouls}</ThemedText>
                </View>
              </View>
            </>
          ) : null}

          {props.variant === "club_played" ? (
            <View style={styles.rowBetween}>
              <View style={styles.dresRow}>
                <MaterialIcons name="event-available" size={16} color={theme.textMuted} />
                <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>Meč</ThemedText>
                <ThemedText style={[styles.valSm, { color: theme.text }]}>Završen</ThemedText>
              </View>
              <ThemedText style={[styles.val, { color: theme.text }]}>{props.scoreLine}</ThemedText>
            </View>
          ) : null}

          {props.variant === "club_upcoming" ? (
            <>
              <View style={styles.rowBetween}>
                <View style={styles.dresRow}>
                  <MaterialIcons name="place" size={16} color={theme.textMuted} />
                  <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>Mesto</ThemedText>
                  <ThemedText
                    numberOfLines={2}
                    style={[styles.valSm, { color: theme.text, flex: 1 }]}>
                    {props.venue?.trim() ? props.venue.trim() : "—"}
                  </ThemedText>
                </View>
                <View style={{ alignItems: "flex-end", maxWidth: "42%" }}>
                  <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>Status</ThemedText>
                  <ThemedText
                    numberOfLines={2}
                    type="defaultSemiBold"
                    style={{ color: theme.text, fontSize: 13, textAlign: "right" }}>
                    {props.status}
                  </ThemedText>
                </View>
              </View>
              {props.homeScore != null && props.awayScore != null ? (
                <View style={[styles.rowBetween, styles.rowLast]}>
                  <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>
                    {props.status === "live" ? "Uživo" : "Rezultat"}
                  </ThemedText>
                  <ThemedText style={[styles.val, { color: theme.text }]}>
                    {props.homeScore} : {props.awayScore}
                  </ThemedText>
                </View>
              ) : null}
              {props.matchTime?.trim() || props.rosterSummary || props.rosterNeedsAttention ? (
                <View style={[styles.rowBetween, styles.rowLast]}>
                  <View style={styles.dresRow}>
                    <MaterialIcons name="schedule" size={16} color={theme.textMuted} />
                    <ThemedText style={[styles.lbl, { color: theme.textSecondary }]}>Vreme</ThemedText>
                    <ThemedText
                      numberOfLines={1}
                      style={[styles.valSm, { color: theme.text, flexShrink: 1 }]}>
                      {props.matchTime?.trim() ? props.matchTime.trim() : "—"}
                    </ThemedText>
                  </View>
                  <View style={styles.rosterTail}>
                    {props.rosterSummary ? (
                      <ThemedText
                        numberOfLines={1}
                        style={[
                          styles.valSm,
                          {
                            color: props.rosterNeedsAttention ? theme.tint : theme.text,
                            fontWeight: props.rosterNeedsAttention ? "800" : "600",
                          },
                        ]}>
                        {props.rosterSummary}
                      </ThemedText>
                    ) : null}
                    {props.rosterNeedsAttention ? (
                      <MaterialIcons name="star" size={18} color={theme.tint} accessibilityLabel="Sastav nije kompletan" />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={styles.pressWrap}
        accessibilityRole="button"
        android_ripple={{ color: "rgba(0,0,0,0.08)" }}>
        {shell}
      </Pressable>
    );
  }

  return shell;
}

const styles = StyleSheet.create({
  pressWrap: { marginBottom: 2 },
  shell: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    minHeight: 96,
  },
  shellSpaced: { marginBottom: 2 },
  watermarkWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 0,
  },
  /** Jedan rgba sloj — izbegava sečenje od ThemedText / opacity stack-a */
  watermarkLetter: {
    fontWeight: "900",
    color: "rgba(184, 92, 46, 0.2)",
    textAlign: "center",
    includeFontPadding: false,
  },
  rowOuter: {
    flexDirection: "row",
    position: "relative",
    zIndex: 1,
  },
  stripe: { width: 5, alignSelf: "stretch" },
  body: { flex: 1, padding: 12, gap: 10, zIndex: 1 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  dresRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  rowLast: { marginTop: 2 },
  vsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  vsText: { flexShrink: 1, fontSize: 15 },
  dateTxt: { fontSize: 13, fontWeight: "700" },
  pair: { flex: 1, minWidth: 0, gap: 2 },
  lbl: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  val: { fontSize: 17, fontWeight: "800" },
  valSm: { fontSize: 14, fontWeight: "600" },
  ptsSuf: { fontSize: 13, fontWeight: "600" },
  ptsKind: { fontSize: 13, fontWeight: "700" },
  ptsSep: { fontSize: 13, fontWeight: "600" },
  rosterTail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "48%",
    justifyContent: "flex-end",
  },
});
