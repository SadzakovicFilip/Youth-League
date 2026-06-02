import type { MatchRichTheme } from '@/components/shared/match-rich-card';
import type { AppThemeColors } from '@/contexts/app-theme-context';

/** Plava teget + žuta (munja) — vizuelno odvojeno od kalendara utakmica. */
export type TrainingCalendarPalette = {
  navy: string;
  /** Ikone, munje, akcenti na svetloj podlozi. */
  yellow: string;
  /** Tekst na plavoj podlozi — svetlija nijansa radi kontrasta. */
  yellowOnNavy: string;
  wash: string;
  cardSurface: string;
};

export function getTrainingCalendarPalette(scheme: 'light' | 'dark'): TrainingCalendarPalette {
  if (scheme === 'dark') {
    return {
      navy: '#4A7AB8',
      yellow: '#FACC15',
      yellowOnNavy: '#FEF08A',
      wash: 'rgba(250, 204, 21, 0.16)',
      cardSurface: 'rgba(30, 58, 95, 0.35)',
    };
  }
  return {
    navy: '#1E3A5F',
    yellow: '#FACC15',
    yellowOnNavy: '#FDE047',
    wash: 'rgba(253, 224, 71, 0.18)',
    cardSurface: 'rgba(30, 58, 95, 0.06)',
  };
}

export function buildTrainingRichTheme(
  colors: AppThemeColors,
  scheme: 'light' | 'dark',
): { theme: MatchRichTheme; stripeColor: string; palette: TrainingCalendarPalette } {
  const palette = getTrainingCalendarPalette(scheme);
  return {
    palette,
    stripeColor: palette.navy,
    theme: {
      surfaceMuted: palette.cardSurface,
      borderStrong: scheme === 'dark' ? '#3D5A80' : '#B8C9DC',
      tint: palette.yellow,
      text: colors.text,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      danger: colors.danger,
    },
  };
}
