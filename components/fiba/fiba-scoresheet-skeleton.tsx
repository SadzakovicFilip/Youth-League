/**
 * FIBA scoresheet — statički kostur (bez logike upisa).
 * Responsive: skalira prema širini; vertikalni scroll samo kad ne stane (npr. telefon).
 */
import {
  useFibaScoresheetMetrics,
  type FibaScoresheetMetrics,
} from "@/components/fiba/fiba-scoresheet-metrics";
import type {
  MatchScorebookPayload,
  MatchScorebookRosterPlayer,
} from "@/components/match-scorebook-types";
import { Image } from "expo-image";
import { Fragment, useState, type ReactNode } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PLAYER_SLOTS = 12;
const TEAM_FOUL_BOXES = 4;
/** Isti odnos kolona kao Team A/B + Running Score u telu zapisnika. */
const SCORESHEET_LEFT_FLEX = 0.54;
const SCORESHEET_RIGHT_FLEX = 0.46;

const SCORE_SUMMARY_ROW_COUNT = 5;
const SCORE_SUMMARY_ROW_GAP = 0.3;
const QUARTER_CIRCLE_INNER_PAD = 0.2;
const SCORE_SUMMARY_QUARTER_ROWS = [
  { kind: "quarter" as const, number: "1" },
  { kind: "quarter" as const, number: "2" },
  { kind: "quarter" as const, number: "3" },
  { kind: "quarter" as const, number: "4" },
  { kind: "overtimes" as const },
];
const RUNNING_SCORE_SECTIONS = [
  { start: 1, end: 40 },
  { start: 41, end: 80 },
  { start: 81, end: 120 },
  { start: 121, end: 160 },
] as const;
/** Header logo (International Basketball Federation) — width / height. */
const FIBA_LOGO_ASPECT_RATIO = 2.35;
/** Udeo širine header reda za FIBA logo (ostatak → naslov SCORESHEET). */
const FIBA_HEADER_LOGO_FLEX = 0.42;

type Props = {
  data: MatchScorebookPayload;
};

function playerLabel(p: MatchScorebookRosterPlayer | undefined) {
  if (!p) return "";
  if (p.last_name || p.first_name) {
    return [p.last_name, p.first_name].filter(Boolean).join(", ");
  }
  return p.display_name?.trim() || p.username?.trim() || "";
}

function formatMatchDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatMatchTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
}

function officialName(
  officials: MatchScorebookPayload["sudije"],
  index: number,
) {
  const o = officials?.[index];
  if (!o) return "";
  if (o.last_name || o.first_name) {
    return [o.last_name, o.first_name].filter(Boolean).join(" ");
  }
  return o.display_name?.trim() || o.username?.trim() || "";
}

function BorderedBox({
  m,
  style,
  children,
  center,
  noTopBorder,
  noLeftBorder,
  noBottomBorder,
}: {
  m: FibaScoresheetMetrics;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  center?: boolean;
  noTopBorder?: boolean;
  noLeftBorder?: boolean;
  noBottomBorder?: boolean;
}) {
  return (
    <View
      style={[
        {
          borderWidth: m.border,
          borderTopWidth: noTopBorder ? 0 : m.border,
          borderLeftWidth: noLeftBorder ? 0 : m.border,
          borderBottomWidth: noBottomBorder ? 0 : m.border,
          borderColor: "#111",
          backgroundColor: "#fff",
          justifyContent: center ? "center" : "flex-start",
          alignItems: center ? "center" : "stretch",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Label({
  m,
  text,
  bold,
  center,
  micro,
}: {
  m: FibaScoresheetMetrics;
  text: string;
  bold?: boolean;
  center?: boolean;
  micro?: boolean;
}) {
  return (
    <Text
      style={{
        fontSize: micro ? m.fontMicro : m.fontXs,
        fontWeight: bold ? "700" : "400",
        color: "#111",
        textAlign: center ? "center" : "left",
        width: center ? "100%" : undefined,
        lineHeight: micro ? m.fontMicro + 2 : m.fontXs + 2,
      }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.65}
    >
      {text}
    </Text>
  );
}

function EmptyCell({
  m,
  w,
  h,
}: {
  m: FibaScoresheetMetrics;
  w?: number;
  h?: number;
}) {
  return (
    <BorderedBox
      m={m}
      style={{
        width: w ?? m.cellSm,
        height: h ?? m.rowSm,
        minWidth: w ?? m.cellSm,
      }}
    />
  );
}

/** Flex udeo kolona u tabeli igrača (tim A/B). */
const TEAM_TABLE_COL = {
  licence: 0.62,
  players: 2.35,
  no: 0.48,
  playerIn: 0.58,
  foul: 0.34,
} as const;

const TEAM_TABLE_FLEX_TOTAL =
  TEAM_TABLE_COL.licence +
  TEAM_TABLE_COL.players +
  TEAM_TABLE_COL.no +
  TEAM_TABLE_COL.playerIn +
  TEAM_TABLE_COL.foul * 5;

function teamTableColFlex(colIndex: number) {
  if (colIndex === 0) return TEAM_TABLE_COL.licence;
  if (colIndex === 1) return TEAM_TABLE_COL.players;
  if (colIndex === 2) return TEAM_TABLE_COL.no;
  if (colIndex === 3) return TEAM_TABLE_COL.playerIn;
  return TEAM_TABLE_COL.foul;
}

function teamTableColWidthPct(colIndex: number) {
  return `${(teamTableColFlex(colIndex) / TEAM_TABLE_FLEX_TOTAL) * 100}%`;
}

function teamTableWidthPctFromFlex(flex: number) {
  return `${(flex / TEAM_TABLE_FLEX_TOTAL) * 100}%`;
}

/** Širine ćelija u redu trenera (Head coach / First assistant coach). */
const COACH_ROW_LEFT_FLEX =
  TEAM_TABLE_COL.licence +
  TEAM_TABLE_COL.players +
  TEAM_TABLE_COL.no +
  TEAM_TABLE_COL.playerIn +
  TEAM_TABLE_COL.foul * 2;

const COACH_CELL1_SHRINK = 10;
const COACH_CELL2_GAP = 15;
const COACH_CELL2_SHRINK = 8;

function teamTableColWidthPx(rowWidth: number, colIndex: number) {
  return rowWidth * (teamTableColFlex(colIndex) / TEAM_TABLE_FLEX_TOTAL);
}

function teamTableLeftSectionWidthPx(rowWidth: number) {
  return rowWidth * (COACH_ROW_LEFT_FLEX / TEAM_TABLE_FLEX_TOTAL);
}

function teamTableFoulsFlexSum() {
  return TEAM_TABLE_COL.foul * 5;
}

function teamTableFoulsWidthPct() {
  return `${(teamTableFoulsFlexSum() / TEAM_TABLE_FLEX_TOTAL) * 100}%`;
}

function MetaCheckbox({
  m,
  size,
  touchLeft,
}: {
  m: FibaScoresheetMetrics;
  size?: number;
  touchLeft?: boolean;
}) {
  const box = size ?? m.cellSm;
  return (
    <View
      style={{
        width: box,
        height: box,
        borderWidth: m.border,
        borderColor: "#111",
        backgroundColor: "#fff",
        marginLeft: touchLeft ? -m.border : 0,
      }}
    />
  );
}

function MetaCheckboxRow({
  m,
  label,
  count,
}: {
  m: FibaScoresheetMetrics;
  label: string;
  count: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 1 }}>
      <Label m={m} text={label} micro />
      <View style={{ flexDirection: "row", marginLeft: 2 }}>
        {Array.from({ length: count }, (_, i) => (
          <MetaCheckbox key={i} m={m} touchLeft={i > 0} />
        ))}
      </View>
    </View>
  );
}

function TeamTimeoutsPanel({ m }: { m: FibaScoresheetMetrics }) {
  return (
    <View style={{ flex: 1 }}>
      <Label m={m} text="Time-outs" bold micro />
      <MetaCheckboxRow m={m} label="H1" count={2} />
      <MetaCheckboxRow m={m} label="H2" count={3} />
      <MetaCheckboxRow m={m} label="OT" count={3} />
    </View>
  );
}

function teamFoulBoxSize(m: FibaScoresheetMetrics) {
  return Math.max(m.cellXs, Math.round(m.cellSm * 0.88));
}

function teamFoulBoxesRowWidth(m: FibaScoresheetMetrics) {
  const box = teamFoulBoxSize(m);
  return TEAM_FOUL_BOXES * box - (TEAM_FOUL_BOXES - 1) * m.border;
}

function teamHccCheckboxSize(m: FibaScoresheetMetrics) {
  return Math.max(m.cellSm, Math.round(m.cellMd * 0.95));
}

function teamHccBoxesRowWidth(m: FibaScoresheetMetrics) {
  const box = teamHccCheckboxSize(m);
  return 2 * box - m.border;
}

function teamFoulsMicroLabelWidth(m: FibaScoresheetMetrics, text: string) {
  return Math.ceil(text.length * m.fontMicro * 0.62);
}

/** Pomera HCC checkbox-e udesno da desna ivica legne uz desnu ivicu 4. foul ćelije Q3. */
function teamHccCheckboxMarginLeft(m: FibaScoresheetMetrics) {
  const q3BoxesRight =
    teamFoulsMicroLabelWidth(m, "Q3") + 1 + teamFoulBoxesRowWidth(m);
  const hccLabelW = teamFoulsMicroLabelWidth(m, "HCC");
  return Math.max(0, q3BoxesRight - hccLabelW - teamHccBoxesRowWidth(m));
}

function TeamFoulQuarterGroup({
  m,
  quarter,
}: {
  m: FibaScoresheetMetrics;
  quarter: string;
}) {
  const box = teamFoulBoxSize(m);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
      <Label m={m} text={quarter} micro />
      <View style={{ flexDirection: "row", marginLeft: 1 }}>
        {Array.from({ length: TEAM_FOUL_BOXES }, (_, i) => (
          <View
            key={i}
            style={{
              width: box,
              height: box,
              borderWidth: m.border,
              borderColor: "#111",
              marginLeft: i > 0 ? -m.border : 0,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#fff",
            }}
          >
            <Text
              style={{
                fontSize: m.fontMicro,
                color: "#111",
                textAlign: "center",
              }}
            >
              {i + 1}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TeamFoulsPanel({ m }: { m: FibaScoresheetMetrics }) {
  return (
    <View style={{ flex: 1 }}>
      <Label m={m} text="Team fouls" bold micro center />
      <View style={{ flexDirection: "row", marginTop: 2, gap: 4 }}>
        <TeamFoulQuarterGroup m={m} quarter="Q1" />
        <TeamFoulQuarterGroup m={m} quarter="Q2" />
      </View>
      <View style={{ flexDirection: "row", marginTop: 2, gap: 4 }}>
        <TeamFoulQuarterGroup m={m} quarter="Q3" />
        <TeamFoulQuarterGroup m={m} quarter="Q4" />
      </View>
      <View
        style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}
      >
        <Label m={m} text="HCC" micro />
        <View
          style={{
            flexDirection: "row",
            marginLeft: teamHccCheckboxMarginLeft(m),
          }}
        >
          <MetaCheckbox m={m} size={teamHccCheckboxSize(m)} />
          <MetaCheckbox m={m} size={teamHccCheckboxSize(m)} touchLeft />
        </View>
      </View>
    </View>
  );
}

function TeamTableCol({
  m,
  colIndex,
  isLast,
  minHeight,
  header,
  children,
  center,
  left,
}: {
  m: FibaScoresheetMetrics;
  colIndex: number;
  isLast?: boolean;
  minHeight?: number;
  header?: boolean;
  children?: ReactNode;
  center?: boolean;
  left?: boolean;
}) {
  return (
    <View
      style={{
        width: teamTableColWidthPct(colIndex),
        flexGrow: 0,
        flexShrink: 0,
        minWidth: 0,
        borderRightWidth: isLast ? 0 : m.border,
        borderRightColor: "#111",
        paddingHorizontal: header ? 1 : 0,
        justifyContent: "center",
        alignItems: center ? "center" : left ? "flex-start" : "stretch",
        minHeight: minHeight ?? m.rowPlayer,
        backgroundColor: "#fff",
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

function teamTableHeaderFont(m: FibaScoresheetMetrics) {
  return Math.max(4.5, m.fontMicro - 1.5);
}

const TEAM_TABLE_HEADER_LABELS = [
  "Licence no.",
  "Players",
  "No.",
  "Player in",
] as const;
const TEAM_TABLE_FOUL_LABELS = ["1", "2", "3", "4", "5"] as const;

function TeamTableHeaderRows({ m }: { m: FibaScoresheetMetrics }) {
  const totalH = m.rowMd + m.rowSm;
  const headerFont = teamTableHeaderFont(m);

  return (
    <View
      style={{
        width: "100%",
        borderBottomWidth: m.border,
        borderBottomColor: "#111",
      }}
    >
      <View style={{ flexDirection: "row", width: "100%", minHeight: totalH }}>
        {TEAM_TABLE_HEADER_LABELS.map((label, idx) => (
          <TeamTableCol
            key={label}
            m={m}
            colIndex={idx}
            isLast={false}
            minHeight={totalH}
            header
            center
          >
            <View
              style={{
                width: "100%",
                minWidth: 0,
                overflow: "hidden",
                paddingHorizontal: 0,
              }}
            >
              <Text
                style={{
                  fontSize: headerFont,
                  fontWeight: "700",
                  color: "#111",
                  textAlign: "center",
                  width: "100%",
                }}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.4}
              >
                {label}
              </Text>
            </View>
          </TeamTableCol>
        ))}

        <View
          style={{
            width: teamTableFoulsWidthPct(),
            flexGrow: 0,
            flexShrink: 0,
            minWidth: 0,
            minHeight: totalH,
            backgroundColor: "#fff",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: m.rowMd,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 1,
            }}
          >
            <Text
              style={{
                fontSize: headerFont,
                fontWeight: "700",
                color: "#111",
                textAlign: "center",
              }}
            >
              Fouls
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              height: m.rowSm,
            }}
          >
            {TEAM_TABLE_FOUL_LABELS.map((n) => (
              <View
                key={n}
                style={{
                  flex: 1,
                  flexBasis: 0,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: headerFont,
                    fontWeight: "700",
                    color: "#111",
                    textAlign: "center",
                  }}
                >
                  {n}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function TeamTableBodyCell({
  m,
  colIndex,
  text,
  center,
  left,
}: {
  m: FibaScoresheetMetrics;
  colIndex: number;
  text?: string;
  center?: boolean;
  left?: boolean;
}) {
  return (
    <TeamTableCol
      m={m}
      colIndex={colIndex}
      isLast={colIndex === 8}
      left={left}
      center={center && !left}
    >
      {text ? (
        <View style={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
          <Text
            style={{
              fontSize: m.fontMicro,
              color: "#111",
              textAlign: left ? "left" : center ? "center" : "left",
              width: left ? "100%" : undefined,
              paddingHorizontal: left ? 1 : 0,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {text}
          </Text>
        </View>
      ) : null}
    </TeamTableCol>
  );
}

function TeamTableRowCell({
  m,
  widthPct,
  widthPx,
  isLast,
  text,
  center,
  left,
}: {
  m: FibaScoresheetMetrics;
  widthPct?: string;
  widthPx?: number;
  isLast?: boolean;
  text?: string;
  center?: boolean;
  left?: boolean;
}) {
  return (
    <View
      style={{
        width: widthPx ?? widthPct,
        flexGrow: 0,
        flexShrink: 0,
        minWidth: 0,
        borderRightWidth: isLast ? 0 : m.border,
        borderRightColor: "#111",
        justifyContent: "center",
        alignItems: left ? "flex-start" : center ? "center" : "stretch",
        minHeight: m.rowPlayer,
        backgroundColor: "#fff",
        overflow: "hidden",
        paddingHorizontal: left ? 1 : 0,
      }}
    >
      {text ? (
        <View style={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
          <Text
            style={{
              fontSize: m.fontMicro,
              color: "#111",
              textAlign: left ? "left" : center ? "center" : "left",
              width: left ? "100%" : undefined,
              paddingHorizontal: left ? 1 : 0,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TeamCoachTableRow({
  m,
  label,
}: {
  m: FibaScoresheetMetrics;
  label: string;
}) {
  const [rowWidth, setRowWidth] = useState(0);

  const leftSectionWidth =
    rowWidth > 0 ? teamTableLeftSectionWidthPx(rowWidth) : 0;
  const cell1Base =
    rowWidth > 0
      ? teamTableColWidthPx(rowWidth, 0) +
        teamTableColWidthPx(rowWidth, 1) * 0.5
      : 0;
  const cell1Width = Math.max(0, cell1Base - COACH_CELL1_SHRINK);
  const cell2Width =
    rowWidth > 0
      ? Math.max(0, teamTableColWidthPx(rowWidth, 3) - COACH_CELL2_SHRINK)
      : 0;
  const longWidth =
    leftSectionWidth > 0
      ? Math.max(
          0,
          leftSectionWidth -
            cell1Width -
            COACH_CELL1_SHRINK -
            cell2Width -
            COACH_CELL2_GAP,
        )
      : 0;

  const cell1WidthPct = teamTableWidthPctFromFlex(
    TEAM_TABLE_COL.licence + TEAM_TABLE_COL.players * 0.5,
  );
  const cell2WidthPct = teamTableColWidthPct(3);
  const longWidthPct = teamTableWidthPctFromFlex(
    TEAM_TABLE_COL.players * 0.5 + TEAM_TABLE_COL.no + TEAM_TABLE_COL.foul * 2,
  );

  return (
    <View
      onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        width: "100%",
        borderBottomWidth: m.border,
        borderBottomColor: "#111",
        minHeight: m.rowPlayer,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          width:
            rowWidth > 0
              ? leftSectionWidth
              : teamTableWidthPctFromFlex(COACH_ROW_LEFT_FLEX),
          flexGrow: 0,
          flexShrink: 0,
        }}
      >
        <TeamTableRowCell
          m={m}
          widthPx={rowWidth > 0 ? cell1Width : undefined}
          widthPct={rowWidth > 0 ? undefined : cell1WidthPct}
          text={label}
          left
        />
        {rowWidth > 0 ? <View style={{ width: COACH_CELL1_SHRINK }} /> : null}
        <TeamTableRowCell
          m={m}
          widthPx={rowWidth > 0 ? cell2Width : undefined}
          widthPct={rowWidth > 0 ? undefined : cell2WidthPct}
        />
        {rowWidth > 0 ? <View style={{ width: COACH_CELL2_GAP }} /> : null}
        <TeamTableRowCell
          m={m}
          widthPx={rowWidth > 0 ? longWidth : undefined}
          widthPct={rowWidth > 0 ? undefined : longWidthPct}
        />
      </View>

      <TeamTableBodyCell m={m} colIndex={6} center />
      <TeamTableBodyCell m={m} colIndex={7} center />
      <TeamTableBodyCell m={m} colIndex={8} center />
    </View>
  );
}

function TeamPlayerTableRow({
  m,
  licenceText,
  playerText,
  numberText,
}: {
  m: FibaScoresheetMetrics;
  licenceText?: string;
  playerText?: string;
  numberText?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        width: "100%",
        borderBottomWidth: m.border,
        borderBottomColor: "#111",
        minHeight: m.rowPlayer,
      }}
    >
      <TeamTableBodyCell m={m} colIndex={0} text={licenceText} center />
      <TeamTableBodyCell m={m} colIndex={1} text={playerText} left />
      <TeamTableBodyCell m={m} colIndex={2} text={numberText} center />
      <TeamTableBodyCell m={m} colIndex={3} center />
      {TEAM_TABLE_FOUL_LABELS.map((_, idx) => (
        <TeamTableBodyCell key={idx} m={m} colIndex={idx + 4} center />
      ))}
    </View>
  );
}

const RUNNING_SCORE_HEIGHT_TRIM = 0.5;

function TeamBlock({
  m,
  teamLabel,
  teamName,
  roster,
  noTopBorder,
  noBottomBorder,
}: {
  m: FibaScoresheetMetrics;
  teamLabel: "A" | "B";
  teamName: string;
  roster: MatchScorebookRosterPlayer[];
  noTopBorder?: boolean;
  noBottomBorder?: boolean;
}) {
  const slots = Array.from({ length: PLAYER_SLOTS }, (_, i) => roster[i]);

  return (
    <BorderedBox
      m={m}
      noTopBorder={noTopBorder}
      noBottomBorder={noBottomBorder}
    >
      <View
        style={{
          paddingHorizontal: m.pad,
          paddingVertical: 3,
        }}
      >
        <Text style={{ fontSize: m.fontSm, fontWeight: "800", color: "#111" }}>
          Team {teamLabel}
          {teamName ? ` — ${teamName}` : ""}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: m.border,
          borderBottomColor: "#111",
          paddingBottom: 2,
        }}
      >
        <View
          style={{
            flex: 2,
            paddingHorizontal: m.pad,
            paddingTop: m.pad,
          }}
        >
          <TeamTimeoutsPanel m={m} />
        </View>
        <View style={{ flex: 3, paddingHorizontal: m.pad, paddingTop: m.pad }}>
          <TeamFoulsPanel m={m} />
        </View>
      </View>

      <TeamTableHeaderRows m={m} />

      {slots.map((player, idx) => (
        <TeamPlayerTableRow
          key={idx}
          m={m}
          licenceText={player?.license_number ?? undefined}
          playerText={playerLabel(player)}
          numberText={
            player?.jersey_number != null
              ? String(player.jersey_number)
              : undefined
          }
        />
      ))}

      {(["Head coach", "First assistant coach"] as const).map((role) => (
        <TeamCoachTableRow key={role} m={m} label={role} />
      ))}
    </BorderedBox>
  );
}

const RUNNING_SCORE_JERSEY_FLEX = 1;
const RUNNING_SCORE_POINTS_FLEX = 0.82;

function RunningScoreGroupHeader({
  m,
  label,
  flex,
  lastInRow,
}: {
  m: FibaScoresheetMetrics;
  label: "A" | "B";
  flex: number;
  lastInRow?: boolean;
}) {
  return (
    <View
      style={{
        flex,
        minHeight: m.rowMd,
        borderRightWidth: lastInRow ? 0 : m.border,
        borderRightColor: "#111",
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Label m={m} text={label} bold micro center />
    </View>
  );
}

function RunningScoreGridCell({
  m,
  flex,
  height,
  stretch,
  children,
  lastInRow,
}: {
  m: FibaScoresheetMetrics;
  flex: number;
  height?: number;
  stretch?: boolean;
  children?: ReactNode;
  lastInRow?: boolean;
}) {
  return (
    <View
      style={{
        flex,
        minWidth: 0,
        alignSelf: "stretch",
        minHeight: stretch ? undefined : (height ?? m.rowSm),
        borderRightWidth: lastInRow ? 0 : m.border,
        borderRightColor: "#111",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 1,
        backgroundColor: "#fff",
      }}
    >
      {typeof children === "number" || typeof children === "string" ? (
        <Text
          style={{ fontSize: m.fontMicro, color: "#111", textAlign: "center" }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

function runningScoreSectionDividerWidth(m: FibaScoresheetMetrics) {
  return Math.max(2, Math.round(m.border * 2));
}

function RunningScoreSection({
  m,
  start,
  end,
  stretchRows,
}: {
  m: FibaScoresheetMetrics;
  start: number;
  end: number;
  stretchRows?: boolean;
}) {
  const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const rowH = m.rowSm;
  const teamGroupFlex = RUNNING_SCORE_JERSEY_FLEX + RUNNING_SCORE_POINTS_FLEX;

  return (
    <View style={{ flex: 1, minWidth: 0, alignSelf: "stretch" }}>
      <View
        style={{
          flexDirection: "row",
          width: "100%",
          borderBottomWidth: m.border,
          borderBottomColor: "#111",
          minHeight: m.rowMd,
        }}
      >
        <RunningScoreGroupHeader m={m} label="A" flex={teamGroupFlex} />
        <RunningScoreGroupHeader
          m={m}
          label="B"
          flex={teamGroupFlex}
          lastInRow
        />
      </View>

      <View style={stretchRows ? { flex: 1 } : undefined}>
        {nums.map((n) => (
          <View
            key={n}
            style={{
              flexDirection: "row",
              width: "100%",
              borderBottomWidth: m.border,
              borderBottomColor: "#111",
              minHeight: stretchRows ? m.rowSm : rowH,
              flex: stretchRows ? 1 : undefined,
            }}
          >
            <RunningScoreGridCell
              m={m}
              flex={RUNNING_SCORE_JERSEY_FLEX}
              height={rowH}
              stretch={stretchRows}
            />
            <RunningScoreGridCell
              m={m}
              flex={RUNNING_SCORE_POINTS_FLEX}
              height={rowH}
              stretch={stretchRows}
            >
              {n}
            </RunningScoreGridCell>
            <RunningScoreGridCell
              m={m}
              flex={RUNNING_SCORE_POINTS_FLEX}
              height={rowH}
              stretch={stretchRows}
            >
              {n}
            </RunningScoreGridCell>
            <RunningScoreGridCell
              m={m}
              flex={RUNNING_SCORE_JERSEY_FLEX}
              height={rowH}
              stretch={stretchRows}
              lastInRow
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function RunningScorePanel({
  m,
  targetHeight,
}: {
  m: FibaScoresheetMetrics;
  targetHeight?: number;
}) {
  const stretchRows = targetHeight != null && targetHeight > 0;

  return (
    <BorderedBox
      m={m}
      noTopBorder
      noBottomBorder
      style={{
        flex: 1,
        height: stretchRows ? targetHeight : undefined,
        minHeight: stretchRows ? targetHeight : undefined,
        maxHeight: stretchRows ? targetHeight : undefined,
        overflow: stretchRows ? "hidden" : undefined,
      }}
    >
      <View
        style={{
          paddingVertical: m.pad,
          borderBottomWidth: m.border,
          borderBottomColor: "#111",
          backgroundColor: "#fff",
        }}
      >
        <Text
          style={{
            fontSize: m.fontSm,
            fontWeight: "800",
            color: "#111",
            textAlign: "center",
            letterSpacing: 0.5,
          }}
        >
          RUNNING SCORE
        </Text>
      </View>
      <View
        style={{
          flex: stretchRows ? 1 : undefined,
          flexDirection: "row",
          alignItems: "stretch",
        }}
      >
        {RUNNING_SCORE_SECTIONS.map((sec, idx) => (
          <Fragment key={sec.start}>
            <RunningScoreSection
              m={m}
              start={sec.start}
              end={sec.end}
              stretchRows={stretchRows}
            />
            {idx < RUNNING_SCORE_SECTIONS.length - 1 ? (
              <View
                style={{
                  width: runningScoreSectionDividerWidth(m),
                  backgroundColor: "#111",
                  alignSelf: "stretch",
                }}
              />
            ) : null}
          </Fragment>
        ))}
      </View>
    </BorderedBox>
  );
}

function MetaRow({
  m,
  cells,
  last,
  noVerticalBorders,
  outlineOnly,
}: {
  m: FibaScoresheetMetrics;
  cells: { label: string; value: string }[];
  last?: boolean;
  noVerticalBorders?: boolean;
  /** Bez unutrašnjih linija — samo spoljašnji okvir roditelja. */
  outlineOnly?: boolean;
}) {
  const suppressVertical = noVerticalBorders || outlineOnly;

  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: last || outlineOnly ? 0 : m.border,
        borderBottomColor: "#111",
      }}
    >
      {cells.map((cell, i) => (
        <View
          key={cell.label}
          style={{
            flex: 1,
            flexDirection: "row",
            borderRightWidth:
              !suppressVertical && i < cells.length - 1 ? m.border : 0,
            borderRightColor: "#111",
            minHeight: m.rowMd,
            alignItems: "center",
            paddingHorizontal: m.pad,
          }}
        >
          <Label m={m} text={`${cell.label}:`} bold micro />
          <Text
            style={{
              flex: 1,
              fontSize: m.fontXs,
              color: "#111",
              marginLeft: 4,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {cell.value || "…………"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ScoresheetHeader({
  m,
  data,
}: {
  m: FibaScoresheetMetrics;
  data: MatchScorebookPayload;
}) {
  const match = data.match;

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          borderLeftWidth: m.border,
          borderLeftColor: "#111",
          backgroundColor: "#fff",
        }}
      >
        <View
          style={{
            flex: FIBA_HEADER_LOGO_FLEX,
            alignSelf: "stretch",
            overflow: "visible",
            justifyContent: "center",
          }}
        >
          <Image
            source={require("@/assets/Logo/International_Basketball_Federation_logo.svg.png")}
            style={{
              width: "100%",
              aspectRatio: FIBA_LOGO_ASPECT_RATIO,
              alignSelf: "flex-start",
              marginLeft: -Math.max(1, Math.round(4 * m.scale)),
            }}
            contentFit="contain"
            contentPosition="left center"
            accessibilityLabel="FIBA"
          />
        </View>
        <View
          style={{
            flex: 1,
            padding: m.pad,
            paddingLeft: m.pad * 1.25,
            justifyContent: "center",
          }}
        >
          <Label
            m={m}
            text="FEDERATION INTERNATIONALE DE BASKETBALL"
            micro
            center
          />
          <Label
            m={m}
            text="INTERNATIONAL BASKETBALL FEDERATION"
            micro
            center
          />
          <Text
            style={{
              fontSize: m.fontTitle,
              fontWeight: "800",
              color: "#111",
              marginTop: 2,
              textAlign: "center",
              width: "100%",
            }}
          >
            SCORESHEET
          </Text>
        </View>
      </View>

      <MetaRow
        m={m}
        cells={[
          { label: "Team A", value: match.home_club_name ?? "" },
          { label: "Team B", value: match.away_club_name ?? "" },
        ]}
        noVerticalBorders
      />
      <View
        style={{
          borderLeftWidth: m.border,
          borderRightWidth: m.border,
          borderBottomWidth: m.border,
          borderColor: "#111",
          backgroundColor: "#fff",
        }}
      >
        <MetaRow
          m={m}
          cells={[
            {
              label: "Competition",
              value: match.region_name ?? match.league_name ?? "",
            },
            { label: "Date", value: formatMatchDate(match.scheduled_at) },
            { label: "Time", value: formatMatchTime(match.scheduled_at) },
            { label: "Crew Chief", value: "" },
          ]}
          outlineOnly
        />
        <MetaRow
          m={m}
          cells={[
            { label: "Game No.", value: String(match.id) },
            { label: "Place", value: match.venue ?? "" },
            { label: "Umpire 1", value: officialName(data.sudije, 0) },
            { label: "Umpire 2", value: officialName(data.sudije, 1) },
          ]}
          last
          outlineOnly
        />
      </View>
    </View>
  );
}

/** Udeo širine leve footer kolone za input liniju (ista za sve redove). */
const FOOTER_INLINE_INPUT_RATIO = 0.52;

function FooterInlineInputLine({
  m,
  columnWidthPx,
  lineWidthPx,
  align = "left",
}: {
  m: FibaScoresheetMetrics;
  columnWidthPx: number;
  lineWidthPx: number;
  align?: "left" | "right";
}) {
  const columnWidth =
    columnWidthPx > 0 ? columnWidthPx : `${FOOTER_INLINE_INPUT_RATIO * 100}%`;
  const lineWidth = lineWidthPx > 0 ? lineWidthPx : columnWidth;

  return (
    <View
      style={{
        width: columnWidth,
        alignItems: align === "right" ? "flex-end" : "flex-start",
      }}
    >
      <View
        style={{
          width: lineWidth,
          borderBottomWidth: 1,
          borderBottomColor: "#111",
          minHeight: m.rowSm,
        }}
      />
    </View>
  );
}

function FooterInlineRow({
  m,
  label,
  inputWidthPx,
  inputLineWidthPx,
  style,
}: {
  m: FibaScoresheetMetrics;
  label: string;
  inputWidthPx: number;
  inputLineWidthPx?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "flex-end",
          paddingHorizontal: m.pad,
          marginBottom: m.pad,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, marginRight: m.pad }}>
        <Label m={m} text={label} micro />
      </View>
      <FooterInlineInputLine
        m={m}
        columnWidthPx={inputWidthPx}
        lineWidthPx={inputLineWidthPx ?? inputWidthPx}
      />
    </View>
  );
}

function FooterInlineUmpireHalf({
  m,
  label,
}: {
  m: FibaScoresheetMetrics;
  label: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "flex-end",
        minWidth: 0,
      }}
    >
      <View style={{ marginRight: m.pad }}>
        <Label m={m} text={label} micro />
      </View>
      <View
        style={{
          flex: 1,
          borderBottomWidth: 1,
          borderBottomColor: "#111",
          minHeight: m.rowSm,
        }}
      />
    </View>
  );
}

function FooterInlineUmpireRow({ m }: { m: FibaScoresheetMetrics }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingHorizontal: m.pad,
        marginBottom: m.pad,
        gap: m.pad,
      }}
    >
      <FooterInlineUmpireHalf m={m} label="Umpire 1" />
      <FooterInlineUmpireHalf m={m} label="Umpire 2" />
    </View>
  );
}

function OfficialsFooterColumn({
  m,
  children,
}: {
  m: FibaScoresheetMetrics;
  children: (inputWidthPx: number) => ReactNode;
}) {
  const [columnWidth, setColumnWidth] = useState(0);
  const inputWidthPx =
    columnWidth > 0 ? Math.round(columnWidth * FOOTER_INLINE_INPUT_RATIO) : 0;

  return (
    <View
      style={{ flex: SCORESHEET_LEFT_FLEX }}
      onLayout={(e) => setColumnWidth(e.nativeEvent.layout.width)}
    >
      {children(inputWidthPx)}
    </View>
  );
}

function FooterLine({
  m,
  label,
  inline,
}: {
  m: FibaScoresheetMetrics;
  label: string;
  inline?: boolean;
}) {
  if (inline) {
    return <FooterInlineRow m={m} label={label} inputWidthPx={0} />;
  }

  return (
    <View style={{ paddingHorizontal: m.pad, marginBottom: m.pad }}>
      <Label m={m} text={label} micro />
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: "#111",
          marginTop: m.rowSm - 4,
          minHeight: m.rowSm,
        }}
      />
    </View>
  );
}

function scoreSummaryDigitInputWidth(m: FibaScoresheetMetrics) {
  const full = Math.max(m.cellSm, Math.round(m.fontMicro * 3.75));
  return Math.max(1, Math.round(full / 2));
}

function scoreSummaryDigitInputHeight(m: FibaScoresheetMetrics) {
  const full = Math.max(m.rowSm - 2, m.cellSm - 2);
  return Math.max(1, Math.round(full / 2));
}

function ScoreSummaryDigitInput({ m }: { m: FibaScoresheetMetrics }) {
  const w = scoreSummaryDigitInputWidth(m);
  const h = scoreSummaryDigitInputHeight(m);
  return (
    <View
      style={{
        width: w,
        minWidth: w,
        height: h,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#111",
      }}
    />
  );
}

function ScoreSummaryQuarterLabel({
  m,
  row,
}: {
  m: FibaScoresheetMetrics;
  row: (typeof SCORE_SUMMARY_QUARTER_ROWS)[number];
}) {
  if (row.kind === "overtimes") {
    return <Label m={m} text="Overtimes" micro />;
  }

  const circleBorder = Math.max(0.5, m.border / 2);
  const circleSize = Math.max(
    m.cellXs,
    Math.round(m.fontMicro + QUARTER_CIRCLE_INNER_PAD * 2 + circleBorder * 2),
  );

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Math.max(2, m.pad - 1),
      }}
    >
      <View>
        <Label m={m} text="Quarter" micro />
      </View>
      <View
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          borderWidth: circleBorder,
          borderColor: "#111",
          backgroundColor: "#fff",
          overflow: "hidden",
          padding: QUARTER_CIRCLE_INNER_PAD,
        }}
      >
        <View
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: m.fontMicro,
              fontWeight: "700",
              color: "#111",
              textAlign: "center",
              lineHeight: m.fontMicro,
              width: "100%",
              ...(Platform.OS === "android"
                ? {
                    includeFontPadding: false,
                    textAlignVertical: "center" as const,
                  }
                : null),
            }}
          >
            {row.number}
          </Text>
        </View>
      </View>
    </View>
  );
}

const SCORE_SUMMARY_COL_FLEX = {
  scores: 0.75,
  quarters: 1.15,
  team: 1,
} as const;

function ScoreSummaryGridCell({
  m,
  children,
  flex,
  row,
  alignLeft,
}: {
  m: FibaScoresheetMetrics;
  children?: ReactNode;
  flex: number;
  row?: boolean;
  alignLeft?: boolean;
}) {
  return (
    <View
      style={{
        flex,
        alignSelf: "stretch",
        justifyContent: "center",
        flexDirection: row ? "row" : undefined,
        alignItems: row ? "center" : "stretch",
        paddingHorizontal: m.pad,
        gap: row ? m.pad : 0,
      }}
    >
      {alignLeft ? (
        <View
          style={{
            width: "100%",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          {children}
        </View>
      ) : (
        children
      )}
    </View>
  );
}

function ScoreSummaryGrid({ m }: { m: FibaScoresheetMetrics }) {
  return (
    <View style={{ flex: 1, gap: SCORE_SUMMARY_ROW_GAP }}>
      {Array.from({ length: SCORE_SUMMARY_ROW_COUNT }, (_, rowIdx) => (
        <View
          key={rowIdx}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "stretch",
          }}
        >
          <ScoreSummaryGridCell
            m={m}
            flex={SCORE_SUMMARY_COL_FLEX.scores}
            alignLeft
          >
            {rowIdx === 0 ? <Label m={m} text="Scores" bold micro /> : null}
          </ScoreSummaryGridCell>
          <ScoreSummaryGridCell
            m={m}
            flex={SCORE_SUMMARY_COL_FLEX.quarters}
            alignLeft
          >
            <ScoreSummaryQuarterLabel
              m={m}
              row={SCORE_SUMMARY_QUARTER_ROWS[rowIdx]}
            />
          </ScoreSummaryGridCell>
          <ScoreSummaryGridCell m={m} flex={SCORE_SUMMARY_COL_FLEX.team} row>
            <Label m={m} text="A" micro />
            <ScoreSummaryDigitInput m={m} />
          </ScoreSummaryGridCell>
          <ScoreSummaryGridCell m={m} flex={SCORE_SUMMARY_COL_FLEX.team} row>
            <Label m={m} text="B" micro />
            <ScoreSummaryDigitInput m={m} />
          </ScoreSummaryGridCell>
        </View>
      ))}
    </View>
  );
}

function ScoreSummaryAlignedTeamCell({
  m,
  letter,
}: {
  m: FibaScoresheetMetrics;
  letter: "A" | "B";
}) {
  return (
    <ScoreSummaryGridCell m={m} flex={SCORE_SUMMARY_COL_FLEX.team} row>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: m.pad,
          position: "relative",
        }}
      >
        <View
          style={{
            position: "absolute",
            right: "100%",
            marginRight: Math.max(2, m.pad - 1),
            justifyContent: "center",
          }}
        >
          <Label m={m} text="Team" micro />
        </View>
        <Label m={m} text={letter} micro />
        <ScoreSummaryDigitInput m={m} />
      </View>
    </ScoreSummaryGridCell>
  );
}

function FooterFlexInputRow({
  m,
  label,
  style,
}: {
  m: FibaScoresheetMetrics;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "flex-end",
          paddingHorizontal: m.pad,
          paddingBottom: m.pad,
          gap: m.pad,
        },
        style,
      ]}
    >
      <Label m={m} text={label} micro />
      <View
        style={{
          flex: 1,
          borderBottomWidth: 1,
          borderBottomColor: "#111",
          minHeight: m.rowSm,
        }}
      />
    </View>
  );
}

function FinalResultsWinningTeamRow({ m }: { m: FibaScoresheetMetrics }) {
  return <FooterFlexInputRow m={m} label="Name of winning team" />;
}

function FinalResultsPanel({ m }: { m: FibaScoresheetMetrics }) {
  return (
    <View style={{ flex: 1, flexDirection: "column" }}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "stretch",
            overflow: "visible",
          }}
        >
          <ScoreSummaryGridCell
            m={m}
            flex={SCORE_SUMMARY_COL_FLEX.scores}
            alignLeft
          >
            <Label m={m} text="Final Score" bold micro />
          </ScoreSummaryGridCell>
          <ScoreSummaryGridCell
            m={m}
            flex={SCORE_SUMMARY_COL_FLEX.quarters}
            alignLeft
          />
          <ScoreSummaryAlignedTeamCell m={m} letter="A" />
          <ScoreSummaryAlignedTeamCell m={m} letter="B" />
        </View>
      </View>
      <FinalResultsWinningTeamRow m={m} />
    </View>
  );
}

function FooterBlock({
  m,
  children,
  last,
  contentStyle,
  minHeight,
}: {
  m: FibaScoresheetMetrics;
  children: ReactNode;
  last?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  minHeight?: number;
}) {
  return (
    <View
      style={{
        borderBottomWidth: last ? 0 : m.border,
        borderBottomColor: "#111",
        paddingBottom: last ? 0 : m.pad,
        minHeight,
        flex: minHeight ? 1 : undefined,
      }}
    >
      <View style={[{ paddingTop: m.pad, flex: 1 }, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

/** Razmak između leve (timovi / officials) i desne (running score / summary) kolone — ≈ širina jedne foul ćelije. */
function scoresheetColumnGap(m: FibaScoresheetMetrics) {
  const leftShare =
    SCORESHEET_LEFT_FLEX / (SCORESHEET_LEFT_FLEX + SCORESHEET_RIGHT_FLEX);
  const foulCellShare = TEAM_TABLE_COL.foul / TEAM_TABLE_FLEX_TOTAL;
  // G ≈ (sheetWidth - G) * leftShare * foulCellShare
  const gapRatio =
    (leftShare * foulCellShare) / (1 + leftShare * foulCellShare);
  return Math.max(m.pad * 2, Math.round(m.sheetWidth * gapRatio));
}

function ScoresheetFooter({ m }: { m: FibaScoresheetMetrics }) {
  const [tableOfficialsHeight, setTableOfficialsHeight] = useState(0);
  const [refereeSignaturesHeight, setRefereeSignaturesHeight] = useState(0);
  const [protestHeight, setProtestHeight] = useState(0);
  const columnGap = scoresheetColumnGap(m);

  return (
    <View style={{ flexDirection: "row", gap: columnGap }}>
      <OfficialsFooterColumn m={m}>
        {(inputWidthPx) => (
          <BorderedBox m={m}>
            <View
              onLayout={(e) =>
                setTableOfficialsHeight(e.nativeEvent.layout.height)
              }
            >
              <FooterBlock m={m}>
                {[
                  "Scorer",
                  "Assistant Scorer",
                  "Timer",
                  "Shot clock operator",
                ].map((role) => (
                  <FooterInlineRow
                    key={role}
                    m={m}
                    label={role}
                    inputWidthPx={inputWidthPx}
                  />
                ))}
              </FooterBlock>
            </View>
            <View
              onLayout={(e) =>
                setRefereeSignaturesHeight(e.nativeEvent.layout.height)
              }
            >
              <FooterBlock m={m}>
                <FooterInlineRow
                  m={m}
                  label="Crew Chief"
                  inputWidthPx={inputWidthPx}
                />
                <FooterInlineUmpireRow m={m} />
              </FooterBlock>
            </View>
            <View
              onLayout={(e) => setProtestHeight(e.nativeEvent.layout.height)}
            >
              <FooterBlock m={m} last>
                <FooterInlineRow
                  m={m}
                  label="Captain's signature in case of protest"
                  inputWidthPx={inputWidthPx}
                  inputLineWidthPx={inputWidthPx}
                />
              </FooterBlock>
            </View>
          </BorderedBox>
        )}
      </OfficialsFooterColumn>

      <View
        style={{
          flex: SCORESHEET_RIGHT_FLEX,
          position: "relative",
          overflow: "visible",
          alignSelf: "stretch",
        }}
      >
        <BorderedBox
          m={m}
          noLeftBorder
          style={{
            position: "absolute",
            left: -columnGap,
            right: 0,
            top: 0,
            bottom: 0,
          }}
        >
          <FooterBlock
            m={m}
            minHeight={
              tableOfficialsHeight > 0 ? tableOfficialsHeight : undefined
            }
            contentStyle={{ paddingTop: 0, flex: 1 }}
          >
            <ScoreSummaryGrid m={m} />
          </FooterBlock>
          <FooterBlock
            m={m}
            minHeight={
              refereeSignaturesHeight > 0 ? refereeSignaturesHeight : undefined
            }
            contentStyle={{ paddingTop: 0, flex: 1 }}
          >
            <FinalResultsPanel m={m} />
          </FooterBlock>
          <FooterBlock
            m={m}
            last
            minHeight={protestHeight > 0 ? protestHeight : undefined}
          >
            <FooterFlexInputRow m={m} label="Game ended at (hh:mm)" />
          </FooterBlock>
        </BorderedBox>
      </View>
    </View>
  );
}

function ScoresheetBody({
  m,
  data,
}: {
  m: FibaScoresheetMetrics;
  data: MatchScorebookPayload;
}) {
  const [teamsColumnHeight, setTeamsColumnHeight] = useState(0);

  const runningScoreHeight =
    teamsColumnHeight > 0
      ? Math.max(0, Math.round(teamsColumnHeight) - RUNNING_SCORE_HEIGHT_TRIM)
      : 0;

  return (
    <>
      <ScoresheetHeader m={m} data={data} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: scoresheetColumnGap(m),
        }}
      >
        <View style={{ flex: SCORESHEET_LEFT_FLEX }}>
          <TeamBlock
            m={m}
            teamLabel="A"
            teamName={data.match.home_club_name ?? ""}
            roster={data.home_roster}
            noTopBorder
          />
          <View
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              setTeamsColumnHeight(y + height);
            }}
          >
            <TeamBlock
              m={m}
              teamLabel="B"
              teamName={data.match.away_club_name ?? ""}
              roster={data.away_roster}
              noTopBorder
              noBottomBorder
            />
          </View>
        </View>
        <View
          style={{
            flex: SCORESHEET_RIGHT_FLEX,
            height: runningScoreHeight > 0 ? runningScoreHeight : undefined,
            alignSelf: runningScoreHeight > 0 ? "flex-start" : "stretch",
          }}
        >
          <RunningScorePanel m={m} targetHeight={runningScoreHeight} />
        </View>
      </View>
      <ScoresheetFooter m={m} />
    </>
  );
}

export function FibaScoresheetSkeleton({ data }: Props) {
  const m = useFibaScoresheetMetrics();
  const insets = useSafeAreaInsets();
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);

  const scrollEnabled = viewportH > 0 && contentH > viewportH + 2;

  return (
    <View
      style={[styles.root, { paddingBottom: insets.bottom }]}
      onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
    >
      <ScrollView
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={scrollEnabled}
        bounces={scrollEnabled}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[styles.sheet, { width: m.sheetWidth, alignSelf: "center" }]}
          onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
        >
          <ScoresheetBody m={m} data={data} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
  },
  sheet: {
    backgroundColor: "#fff",
    padding: 3,
  },
});
