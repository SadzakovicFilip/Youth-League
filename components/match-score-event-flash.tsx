/**
 * Puni-ekran flash animacija za upis poena / faula / UNDO / pištaljku (2,5 s).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActionAccentHex } from '@/constants/theme';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { MatchScoreFlashVariant } from '@/lib/match-score-flash-label';

export const MATCH_SCORE_FLASH_MS = 2500;

type Props = {
  animationKey: string;
  variant: MatchScoreFlashVariant;
  label: string;
  undoDetail?: string;
  onComplete: () => void;
};

export function MatchScoreEventFlash({
  animationKey,
  variant,
  label,
  undoDetail,
  onComplete,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: MATCH_SCORE_FLASH_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) onCompleteRef.current();
    });
    return () => anim.stop();
  }, [animationKey, progress]);

  const textScale = progress.interpolate({
    inputRange: [0, 0.35, 0.75, 1],
    outputRange: [0.45, 0.85, 1.25, 1.55],
  });

  const textOpacity = progress.interpolate({
    inputRange: [0, 0.12, 0.72, 1],
    outputRange: [0, 1, 1, 0],
  });

  const detailScale = progress.interpolate({
    inputRange: [0, 0.35, 0.75, 1],
    outputRange: [0.55, 0.9, 1.05, 1.15],
  });

  const ringScale = (from: number, to: number) =>
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [from, to],
    });

  const ringOpacity = (peak: number) =>
    progress.interpolate({
      inputRange: [0, 0.15, 0.55, 1],
      outputRange: [0, peak, peak * 0.55, 0],
    });

  const rings = [
    { scale: ringScale(0.35, 2.8), opacity: ringOpacity(0.45), borderWidth: 3 },
    { scale: ringScale(0.5, 3.4), opacity: ringOpacity(0.3), borderWidth: 2 },
    { scale: ringScale(0.65, 4.2), opacity: ringOpacity(0.18), borderWidth: 1.5 },
  ];

  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.center}>
        {rings.map((ring, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                borderWidth: ring.borderWidth,
                borderColor: ActionAccentHex,
                opacity: ring.opacity,
                transform: [{ scale: ring.scale }],
              },
            ]}
          />
        ))}
        <Animated.View
          style={{
            opacity: textOpacity,
            transform: [{ scale: textScale }],
            alignItems: 'center',
          }}>
          {variant === 'whistle' ? (
            <>
              <MaterialCommunityIcons name="whistle" size={96} color={ActionAccentHex} />
              {undoDetail ? (
                <Animated.Text
                  style={[
                    styles.whistleDetail,
                    { transform: [{ scale: detailScale }] },
                  ]}>
                  {undoDetail}
                </Animated.Text>
              ) : null}
            </>
          ) : variant === 'undo' ? (
            <>
              <Animated.Text style={styles.undoArrow}>{label}</Animated.Text>
              {undoDetail ? (
                <Animated.Text
                  style={[
                    styles.undoDetail,
                    { transform: [{ scale: detailScale }] },
                  ]}>
                  {undoDetail}
                </Animated.Text>
              ) : null}
            </>
          ) : (
            <Animated.Text style={styles.scoreLabel}>{label}</Animated.Text>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  center: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  scoreLabel: {
    color: ActionAccentHex,
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingHorizontal: 8,
    maxWidth: 260,
  },
  undoArrow: {
    color: ActionAccentHex,
    fontWeight: '900',
    fontSize: 88,
    lineHeight: 92,
    textAlign: 'center',
    includeFontPadding: false,
  },
  undoDetail: {
    color: ActionAccentHex,
    fontWeight: '800',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
    maxWidth: 260,
  },
  whistleDetail: {
    color: ActionAccentHex,
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    maxWidth: 260,
  },
});
