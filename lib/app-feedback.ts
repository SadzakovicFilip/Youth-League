import * as Haptics from 'expo-haptics';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS, type AVPlaybackSource } from 'expo-av';

import {
  APP_FEEDBACK_SOUND_ASSETS,
  BOUNCE_SOUND_IDS,
  CATCH_SOUND_IDS,
  DEFAULT_UI_SOUND_ID,
  SWISH_SOUND_IDS,
  type AppFeedbackSoundAssetId,
} from '@/lib/app-feedback-sounds';
import {
  scheduleTapFeedback,
  setTapGestureListener,
} from '@/lib/app-feedback-touch';
import type { MatchScoreFlashPayload } from '@/lib/match-score-flash-label';

export type AppFeedbackKind =
  | 'ballBounce'
  | 'doubleBounce'
  | 'swish'
  | 'swishRandom'
  | 'squeak'
  | 'squeakRandom'
  | 'ballCatch'
  | 'stopwatchStart'
  | 'whistleStart'
  | 'matchEnd'
  | 'scoreFoul'
  | 'undo';

type FeedbackPrefs = {
  soundsEnabled: boolean;
  vibrationEnabled: boolean;
  isMatchMuted: (matchId: number) => boolean;
};

type TriggerOptions = {
  matchId?: number;
  /** Preskoči globalne zvuk/vibracija preference (npr. drawer toggle). */
  force?: boolean;
  soundId?: AppFeedbackSoundAssetId;
};

const prefsRef: FeedbackPrefs = {
  soundsEnabled: true,
  vibrationEnabled: true,
  isMatchMuted: () => false,
};

let modeConfigured = false;

/** SFX u memoriji — bez createAsync/unload pri svakom kliku. */
const soundPool = new Map<AppFeedbackSoundAssetId, Audio.Sound>();
let preloadPromise: Promise<void> | null = null;

const FEEDBACK_DEBOUNCE_MS = 95;
let lastFeedbackAt = 0;

const PRELOADED_SOUND_IDS: AppFeedbackSoundAssetId[] = [
  DEFAULT_UI_SOUND_ID,
  'ballBounce2',
  'doubleSqueak',
  'doubleBounce',
  'swishNice',
  'whistleLong',
  'buzzerEnd',
  'buzzerFoul',
];

export async function preloadAppFeedbackSounds(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    await ensureAudioMode();
    await Promise.all(
      PRELOADED_SOUND_IDS.map(async (id) => {
        if (soundPool.has(id)) return;
        try {
          const { sound } = await Audio.Sound.createAsync(
            APP_FEEDBACK_SOUND_ASSETS[id] as AVPlaybackSource,
            { shouldPlay: false, volume: volumeForSound(id) },
          );
          soundPool.set(id, sound);
        } catch {
          /* pojedinačni asset nije kritičan */
        }
      }),
    );
  })();
  return preloadPromise;
}

export function bindAppFeedbackPrefs(prefs: FeedbackPrefs): void {
  prefsRef.soundsEnabled = prefs.soundsEnabled;
  prefsRef.vibrationEnabled = prefs.vibrationEnabled;
  prefsRef.isMatchMuted = prefs.isMatchMuted;
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/** UI klikovi — fiksni zvuk po kontekstu. */
function soundIdForUiKind(kind?: AppFeedbackKind): AppFeedbackSoundAssetId {
  switch (kind) {
    case 'ballBounce':
      return 'ballBounce2';
    case 'squeak':
    case 'squeakRandom':
      return 'doubleSqueak';
    case 'swish':
    case 'swishRandom':
      return DEFAULT_UI_SOUND_ID;
    default:
      return DEFAULT_UI_SOUND_ID;
  }
}

/** Live box score / match događaji — ne menjati mapiranje. */
function soundIdForMatchKind(kind: AppFeedbackKind): AppFeedbackSoundAssetId {
  switch (kind) {
    case 'swish':
    case 'swishRandom':
      return pickRandom(SWISH_SOUND_IDS);
    case 'ballBounce':
      return pickRandom(BOUNCE_SOUND_IDS);
    case 'doubleBounce':
      return 'doubleBounce';
    case 'squeak':
    case 'squeakRandom':
    case 'stopwatchStart':
    case 'undo':
      return pickRandom(BOUNCE_SOUND_IDS);
    case 'ballCatch':
      return pickRandom(CATCH_SOUND_IDS);
    case 'whistleStart':
      return 'whistleLong';
    case 'matchEnd':
      return 'buzzerEnd';
    case 'scoreFoul':
      return 'buzzerFoul';
    default:
      return pickRandom(SWISH_SOUND_IDS);
  }
}

function volumeForSound(id: AppFeedbackSoundAssetId): number {
  if (id === 'doubleSqueak') return 0.82;
  if (id === 'buzzerFoul' || id === 'buzzerEnd') return 0.78;
  if (id.startsWith('swish')) return 0.92;
  return 1;
}

async function ensureAudioMode(): Promise<void> {
  if (modeConfigured) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: false,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  modeConfigured = true;
}

async function playPooledSound(id: AppFeedbackSoundAssetId): Promise<void> {
  const pooled = soundPool.get(id);
  if (!pooled) return;
  const status = await pooled.getStatusAsync();
  if (!status.isLoaded) return;
  if (status.isPlaying) {
    await pooled.stopAsync();
  }
  await pooled.setPositionAsync(0);
  await pooled.setVolumeAsync(volumeForSound(id));
  await pooled.playAsync();
}

async function playSoundOneShot(id: AppFeedbackSoundAssetId): Promise<void> {
  const { sound } = await Audio.Sound.createAsync(APP_FEEDBACK_SOUND_ASSETS[id], {
    shouldPlay: true,
    volume: volumeForSound(id),
  });
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      void sound.unloadAsync();
    }
  });
}

async function playSound(id: AppFeedbackSoundAssetId): Promise<void> {
  try {
    await preloadAppFeedbackSounds();
    if (soundPool.has(id)) {
      await playPooledSound(id);
      return;
    }
    await playSoundOneShot(id);
  } catch {
    /* SFX nije kritičan */
  }
}

function uiLightHaptic(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function hapticForKind(kind: AppFeedbackKind): void {
  switch (kind) {
    case 'scoreFoul':
    case 'matchEnd':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case 'whistleStart':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'undo':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    default:
      uiLightHaptic();
      break;
  }
}

function isBlocked(opts?: TriggerOptions): boolean {
  if (opts?.force) return false;
  if (opts?.matchId != null && prefsRef.isMatchMuted(opts.matchId)) return true;
  return false;
}

function markFeedbackPlayed(): boolean {
  const now = Date.now();
  if (now - lastFeedbackAt < FEEDBACK_DEBOUNCE_MS) return false;
  lastFeedbackAt = now;
  return true;
}

function resolveUiSoundId(opts?: TriggerOptions, kind?: AppFeedbackKind): AppFeedbackSoundAssetId {
  return opts?.soundId ?? soundIdForUiKind(kind);
}

function executeTapFeedback(opts?: TriggerOptions, kind?: AppFeedbackKind): void {
  if (isBlocked(opts)) return;
  if (!markFeedbackPlayed()) return;

  const allowVibration = opts?.force || prefsRef.vibrationEnabled;
  const allowSound = opts?.force || prefsRef.soundsEnabled;

  if (allowVibration) uiLightHaptic();
  if (allowSound) void playSound(resolveUiSoundId(opts, kind));
}

export function triggerTabPressFeedback(opts?: TriggerOptions): void {
  scheduleTapFeedback('tab', opts);
}

export function triggerGlobalUiClickFeedback(opts?: TriggerOptions): void {
  scheduleTapFeedback('ui', opts);
}

let trainingTabArm = false;

/** Tab „Treninzi” — pozovi iz tabPress listenera pre onPressIn. */
export function armTrainingTabPressSound(): void {
  trainingTabArm = true;
  scheduleTapFeedback('tab', { soundId: 'doubleSqueak' });
}

export function consumeTrainingTabArm(): boolean {
  if (!trainingTabArm) return false;
  trainingTabArm = false;
  return true;
}

/** Tab „Treninzi” (trener / igrač) — ulazak u trening sekciju. */
export function triggerTrainingSectionFeedback(): void {
  armTrainingTabPressSound();
}

/** Login intro — uvek double bounce (poštuje ZVUK toggle). */
export function playLoginIntroSound(): void {
  if (!prefsRef.soundsEnabled) return;
  void playSound('doubleBounce');
}

setTapGestureListener((isTap, scheduled) => {
  if (!isTap) return;
  executeTapFeedback(scheduled?.opts);
});

export function triggerAppFeedback(kind: AppFeedbackKind, opts?: TriggerOptions): void {
  if (isBlocked(opts)) return;

  const allowVibration = opts?.force || prefsRef.vibrationEnabled;
  const allowSound = opts?.force || prefsRef.soundsEnabled;

  if (allowVibration) {
    hapticForKind(kind);
  }
  if (allowSound) {
    void playSound(soundIdForMatchKind(kind));
  }
}

export function triggerDrawerToggleFeedback(): void {
  executeTapFeedback({ force: true });
}

export function matchFlashFeedbackKind(payload: MatchScoreFlashPayload): AppFeedbackKind | null {
  if (payload.variant === 'whistle') {
    return payload.whistlePhase === 'end' ? 'matchEnd' : 'whistleStart';
  }
  if (payload.variant === 'undo') return 'undo';
  if (payload.variant === 'score') {
    return payload.eventType === 'foul' ? 'scoreFoul' : 'swish';
  }
  return null;
}

export function triggerPressInFeedback(kind?: AppFeedbackKind, matchId?: number): void {
  triggerGlobalUiClickFeedback({
    matchId,
    soundId: soundIdForUiKind(kind),
  });
}

/** Okida SFX/haptic odmah na pritisak, pa izvršava akciju. */
export function runWithPressFeedback(
  kind?: AppFeedbackKind,
  action?: () => void,
  matchId?: number,
): void {
  triggerPressInFeedback(kind, matchId);
  action?.();
}

export function playMatchAppSoundForFlash(
  payload: MatchScoreFlashPayload,
  matchId?: number,
): void {
  const kind = matchFlashFeedbackKind(payload);
  if (!kind) return;
  triggerAppFeedback(kind, matchId != null ? { matchId } : undefined);
}
