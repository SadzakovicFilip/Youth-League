/** Registar lokalnih SFX asset-a (MP3). */
export const APP_FEEDBACK_SOUND_ASSETS = {
  ballBounce: require('@/assets/sounds/Bounce/BallBounce.mp3'),
  ballBounce2: require('@/assets/sounds/Bounce/BallBounce2.mp3'),
  doubleBounce: require('@/assets/sounds/Bounce/DoubleBounce.mp3'),
  bounceOutdoor: require('@/assets/sounds/Bounce/BounceOutdoor.mp3'),
  swishNice: require('@/assets/sounds/Swish/SwishNice.mp3'),
  swishMedium: require('@/assets/sounds/Swish/SwishMedium.mp3'),
  swishFluent: require('@/assets/sounds/Swish/SwishFluent.mp3'),
  ballCatch: require('@/assets/sounds/Catch/BallCatch.mp3'),
  ballCatch2: require('@/assets/sounds/Catch/BallCatch2.mp3'),
  whistleLong: require('@/assets/sounds/Whistle/WhistleLong.mp3'),
  buzzerEnd: require('@/assets/sounds/Buzzer/BuzzerEnd.mp3'),
  buzzerFoul: require('@/assets/sounds/Buzzer/BuzzerFoul.mp3'),
  doubleSqueak: require('@/assets/sounds/Squeak/Squeak1.mp3'),
} as const;

export type AppFeedbackSoundAssetId = keyof typeof APP_FEEDBACK_SOUND_ASSETS;

/** Podrazumevani UI klik — sve osim posebnih slučajeva. */
export const DEFAULT_UI_SOUND_ID = 'swishMedium' as const satisfies AppFeedbackSoundAssetId;

export const BOUNCE_SOUND_IDS = [
  'ballBounce',
  'ballBounce2',
  'doubleBounce',
  'bounceOutdoor',
] as const satisfies readonly AppFeedbackSoundAssetId[];

export const SWISH_SOUND_IDS = [
  'swishNice',
  'swishMedium',
  'swishFluent',
] as const satisfies readonly AppFeedbackSoundAssetId[];

export const CATCH_SOUND_IDS = [
  'ballCatch',
  'ballCatch2',
] as const satisfies readonly AppFeedbackSoundAssetId[];

/** Bounce + swish + catch — za klilke po UI-ju. */
export const UI_CLICK_SOUND_IDS = [
  ...BOUNCE_SOUND_IDS,
  ...SWISH_SOUND_IDS,
  ...CATCH_SOUND_IDS,
] as const satisfies readonly AppFeedbackSoundAssetId[];
