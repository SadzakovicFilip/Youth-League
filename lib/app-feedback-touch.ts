import type { GestureResponderEvent } from 'react-native';

export type TapFeedbackKind = 'ui' | 'tab';

export type TapFeedbackOptions = {
  matchId?: number;
  force?: boolean;
  soundId?: import('@/lib/app-feedback-sounds').AppFeedbackSoundAssetId;
};

type ScheduledTap = {
  kind: TapFeedbackKind;
  opts?: TapFeedbackOptions;
};

const TAP_SLOP_PX = 14;
const TAP_MAX_MS = 500;

let tracking = false;
let touchMoved = false;
let startX = 0;
let startY = 0;
let startTime = 0;
let scheduledTap: ScheduledTap | null = null;

type TapGestureListener = (isTap: boolean, scheduled: ScheduledTap | null) => void;
let tapGestureListener: TapGestureListener | null = null;

export function setTapGestureListener(listener: TapGestureListener | null): void {
  tapGestureListener = listener;
}

export function scheduleTapFeedback(kind: TapFeedbackKind, opts?: TapFeedbackOptions): void {
  scheduledTap = { kind, opts };
}

export function clearScheduledTapFeedback(): void {
  scheduledTap = null;
}

function finishGesture(isTap: boolean): void {
  const pending = scheduledTap;
  scheduledTap = null;
  tapGestureListener?.(isTap, pending);
}

export function appFeedbackTouchStartCapture(e: GestureResponderEvent): void {
  tracking = true;
  touchMoved = false;
  startX = e.nativeEvent.pageX;
  startY = e.nativeEvent.pageY;
  startTime = Date.now();
}

export function appFeedbackTouchMoveCapture(e: GestureResponderEvent): void {
  if (!tracking || touchMoved) return;
  const dx = Math.abs(e.nativeEvent.pageX - startX);
  const dy = Math.abs(e.nativeEvent.pageY - startY);
  if (dx > TAP_SLOP_PX || dy > TAP_SLOP_PX) {
    touchMoved = true;
  }
}

export function appFeedbackTouchEndCapture(): void {
  if (!tracking) return;
  const isTap = !touchMoved && Date.now() - startTime <= TAP_MAX_MS;
  tracking = false;
  finishGesture(isTap);
}

export function appFeedbackTouchCancelCapture(): void {
  if (!tracking) return;
  tracking = false;
  finishGesture(false);
}

export const appFeedbackTouchHandlers = {
  onTouchStartCapture: appFeedbackTouchStartCapture,
  onTouchMoveCapture: appFeedbackTouchMoveCapture,
  onTouchEndCapture: appFeedbackTouchEndCapture,
  onTouchCancelCapture: appFeedbackTouchCancelCapture,
};
