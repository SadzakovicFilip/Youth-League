import * as NavigationBar from 'expo-navigation-bar';
import { requireNativeModule } from 'expo-modules-core';
import { Platform, processColor } from 'react-native';

type ExpoNavigationBarNative = {
  setBackgroundColorAsync: (color: number) => Promise<void>;
};

let native: ExpoNavigationBarNative | null | undefined;

function getExpoNavigationBar(): ExpoNavigationBarNative | null {
  if (Platform.OS !== 'android') return null;
  if (native !== undefined) return native;
  try {
    native = requireNativeModule<ExpoNavigationBarNative>('ExpoNavigationBar');
  } catch {
    native = null;
  }
  return native;
}

/**
 * Fiksna crna system navigation bar + svetli dugmići.
 * JS `setBackgroundColorAsync` je no-op uz edge-to-edge; direktan native poziv i dalje postavlja boju prozora.
 */
export async function applyFixedAndroidNavigationBar(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const processed = processColor('#000000');
  if (typeof processed === 'number') {
    const mod = getExpoNavigationBar();
    try {
      await mod?.setBackgroundColorAsync(processed);
    } catch {
      /* modul nedostupan u dev / web */
    }
  }
  await NavigationBar.setButtonStyleAsync('light');
}
