import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

/** Referentna širina FIBA zapisnika (landscape A4 proporcije). */
const BASE_SHEET_WIDTH = 860;

export type FibaScoresheetMetrics = {
  scale: number;
  border: number;
  sheetWidth: number;
  fontMicro: number;
  fontXs: number;
  fontSm: number;
  fontMd: number;
  fontLg: number;
  fontTitle: number;
  cellXs: number;
  cellSm: number;
  cellMd: number;
  rowSm: number;
  rowMd: number;
  rowPlayer: number;
  pad: number;
  /** Fiksna širina kolone tekućeg rezultata (1–160) — ne menja se po broju cifara. */
  runningScoreColW: number;
  runningScoreFont: number;
};

export function useFibaScoresheetMetrics(): FibaScoresheetMetrics {
  const { width: windowWidth } = useWindowDimensions();

  return useMemo(() => {
    const sheetWidth = Math.max(windowWidth - 8, 320);
    const scale = Math.max(0.48, Math.min(1.08, sheetWidth / BASE_SHEET_WIDTH));

    return {
      scale,
      border: Math.max(1, scale >= 0.75 ? 1 : 0.5),
      sheetWidth,
      fontMicro: Math.max(6, Math.round(7 * scale)),
      fontXs: Math.max(7, Math.round(8 * scale)),
      fontSm: Math.max(8, Math.round(9 * scale)),
      fontMd: Math.max(9, Math.round(10 * scale)),
      fontLg: Math.max(10, Math.round(11 * scale)),
      fontTitle: Math.max(14, Math.round(18 * scale)),
      cellXs: Math.max(10, Math.round(12 * scale)),
      cellSm: Math.max(12, Math.round(14 * scale)),
      cellMd: Math.max(14, Math.round(16 * scale)),
      rowSm: Math.max(11, Math.round(13 * scale)),
      rowMd: Math.max(13, Math.round(15 * scale)),
      rowPlayer: Math.max(12, Math.round(14 * scale)),
      pad: Math.max(2, Math.round(4 * scale)),
      /** Dimenzionisano za jednocifren broj; 2–3 cifre smanjuju font u ćeliji. */
      runningScoreColW: Math.max(9, Math.round(10 * scale)),
      runningScoreFont: Math.max(6, Math.round(7 * scale)),
    };
  }, [windowWidth]);
}
