import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

import type { MatchScoreFlashPayload } from '@/lib/match-score-flash-label';

const SOUND_SOURCES = {
  whistle: require('@/assets/sounds/referee-whistle.mp3'),
  score: require('@/assets/sounds/basketball-swish.mp3'),
  foul: require('@/assets/sounds/buzzer-short.mp3'),
  undo: require('@/assets/sounds/buzzer-short.mp3'),
} as const;

export type MatchAppSoundId = keyof typeof SOUND_SOURCES;

let modeConfigured = false;

export async function ensureMatchAudioMode(): Promise<void> {
  if (modeConfigured) return;
  await Audio.setAudioModeAsync({
    /** Poštuj iOS silent prekidač — bez zvuka kada je telefon utišan. */
    playsInSilentModeIOS: false,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  modeConfigured = true;
}

export function soundForFlashPayload(payload: MatchScoreFlashPayload): MatchAppSoundId | null {
  if (payload.variant === 'whistle') return 'whistle';
  if (payload.variant === 'undo') return 'undo';
  if (payload.variant === 'score') {
    return payload.eventType === 'foul' ? 'foul' : 'score';
  }
  return null;
}

export async function playMatchAppSound(id: MatchAppSoundId): Promise<void> {
  try {
    await ensureMatchAudioMode();
    const volume = id === 'undo' ? 0.5 : id === 'foul' ? 0.72 : 1;
    const { sound } = await Audio.Sound.createAsync(SOUND_SOURCES[id], {
      shouldPlay: true,
      volume,
    });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    /* reprodukcija nije kritična */
  }
}
