/**
 * Youth League — kosarkaška paleta (narandžasto-braon + crn kao akcenti, ne dominantno).
 * Light: bela / off-white osnova. Dark: tamno siva osnova.
 */

import { Platform } from 'react-native';
import type { Theme as NavTheme } from '@react-navigation/native';
import { DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme } from '@react-navigation/native';

/** Akcent — „kožna“ lopta / šav */
export const BasketballAccent = {
  leather: '#B85C2E',
  leatherDeep: '#7A3D1F',
  leatherLight: '#D4783E',
  seam: '#1A1A1A',
  highlight: '#E8A077',
} as const;

export const Colors = {
  light: {
    text: '#121212',
    textSecondary: '#4A4A4A',
    textMuted: '#7A7A7A',
    background: '#FAFAFA',
    backgroundElevated: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F0F0',
    card: '#FFFFFF',
    border: '#E6E6E6',
    borderStrong: '#D0D0D0',
    tint: BasketballAccent.leather,
    accent: BasketballAccent.leather,
    accentMuted: 'rgba(184, 92, 46, 0.12)',
    icon: '#6B6B6B',
    tabIconDefault: '#8A8A8A',
    tabIconSelected: BasketballAccent.leather,
    danger: '#B3261E',
    success: '#2E7D32',
    link: BasketballAccent.leatherDeep,
    inputBackground: '#FFFFFF',
    inputBorder: '#D8D8D8',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E8E8E8',
    overlayLine: 'rgba(18, 18, 18, 0.06)',
  },
  dark: {
    text: '#F2F2F2',
    textSecondary: '#C4C4C4',
    textMuted: '#9A9A9A',
    background: '#161616',
    backgroundElevated: '#1C1C1C',
    surface: '#222222',
    surfaceMuted: '#2C2C2C',
    card: '#242424',
    border: '#383838',
    borderStrong: '#4A4A4A',
    tint: BasketballAccent.leatherLight,
    accent: BasketballAccent.leatherLight,
    accentMuted: 'rgba(212, 120, 62, 0.18)',
    icon: '#A8A8A8',
    tabIconDefault: '#888888',
    tabIconSelected: BasketballAccent.leatherLight,
    danger: '#F28B82',
    success: '#81C784',
    link: BasketballAccent.highlight,
    inputBackground: '#2A2A2A',
    inputBorder: '#444444',
    tabBar: '#1E1E1E',
    tabBarBorder: '#333333',
    overlayLine: 'rgba(255, 255, 255, 0.05)',
  },
};

export type ColorName = keyof typeof Colors.light & keyof typeof Colors.dark;

export function getNavigationTheme(scheme: 'light' | 'dark'): NavTheme {
  const c = Colors[scheme];
  const base = scheme === 'dark' ? NavDarkTheme : NavDefaultTheme;
  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: c.tint,
      background: c.background,
      card: c.surface,
      text: c.text,
      border: c.border,
      notification: c.danger,
    },
  };
}

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
