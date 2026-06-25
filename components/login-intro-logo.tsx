import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { playLoginIntroSound } from '@/lib/app-feedback';

export const LOGIN_LOGO_SIZE = 120;

/** Glavni shrink (udarac). */
export const LOGIN_INTRO_SHRINK_MS = 820;
/** Kratko lega nakon udarca. */
export const LOGIN_INTRO_SETTLE_MS = 240;
export const LOGIN_INTRO_TOTAL_MS = LOGIN_INTRO_SHRINK_MS + LOGIN_INTRO_SETTLE_MS;

const DUST_BURST_MS = 520;
const DUST_PARTICLE_COUNT = 16;

type DustSpec = {
  angle: number;
  distance: number;
  size: number;
  delayMs: number;
  stretch: number;
};

function buildDustSpecs(): DustSpec[] {
  return Array.from({ length: DUST_PARTICLE_COUNT }, (_, i) => {
    const angle = (i / DUST_PARTICLE_COUNT) * Math.PI * 2 + (i % 2 ? 0.22 : -0.15);
    return {
      angle,
      distance: 34 + (i % 4) * 14 + (i % 3) * 6,
      size: 3 + (i % 5) * 1.6,
      delayMs: (i % 4) * 18,
      stretch: i % 2 === 0 ? 1.35 : 0.85,
    };
  });
}

const DUST_SPECS = buildDustSpecs();

type Props = {
  onIntroComplete?: () => void;
};

function DustParticle({ spec, color }: { spec: DustSpec; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      progress.value = withDelay(
        spec.delayMs,
        withTiming(1, { duration: DUST_BURST_MS, easing: Easing.out(Easing.cubic) }),
      );
    }, LOGIN_INTRO_SHRINK_MS);
    return () => clearTimeout(t);
  }, [progress, spec.delayMs]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const spread = spec.distance * t;
    return {
      opacity: (1 - t) * 0.9,
      transform: [
        { translateX: Math.cos(spec.angle) * spread },
        { translateY: Math.sin(spec.angle) * spread * spec.stretch },
        { scaleX: 1 + t * 1.1 },
        { scaleY: 1 + t * 0.45 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.dustParticle,
        {
          width: spec.size,
          height: spec.size * 0.72,
          borderRadius: spec.size,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function HammerDustPuff({ puffColor }: { puffColor: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      progress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
    }, LOGIN_INTRO_SHRINK_MS);
    return () => clearTimeout(t);
  }, [progress]);

  const puffStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const scale = 0.35 + t * 1.65;
    return {
      opacity: (1 - t) * 0.55,
      transform: [{ scale }],
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const scale = 0.5 + t * 2.2;
    return {
      opacity: (1 - t) * 0.35,
      transform: [{ scale }],
    };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.dustPuff, { backgroundColor: puffColor }, puffStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.dustRing, { borderColor: puffColor }, ringStyle]}
      />
    </>
  );
}

/** Udar logoa: fullscreen shrink + rotacija + prašina pri impactu. */
export function LoginIntroLogoMark({ onIntroComplete }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const { width, height } = useWindowDimensions();
  const startScale = Math.max(width, height) / LOGIN_LOGO_SIZE;

  const scale = useSharedValue(startScale);
  const rotate = useSharedValue(-46);

  const dustColor = scheme === 'dark' ? 'rgba(210, 185, 150, 0.72)' : 'rgba(110, 82, 52, 0.62)';
  const puffColor = scheme === 'dark' ? 'rgba(190, 165, 130, 0.45)' : 'rgba(130, 98, 68, 0.38)';

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.12, {
        duration: LOGIN_INTRO_SHRINK_MS,
        easing: Easing.bezier(0.35, 0.02, 0.85, 1),
      }),
      withTiming(1, {
        duration: LOGIN_INTRO_SETTLE_MS,
        easing: Easing.out(Easing.back(1.15)),
      }),
    );

    rotate.value = withSequence(
      withTiming(8, {
        duration: LOGIN_INTRO_SHRINK_MS,
        easing: Easing.inOut(Easing.cubic),
      }),
      withTiming(0, {
        duration: LOGIN_INTRO_SETTLE_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );

    const soundT = setTimeout(() => playLoginIntroSound(), LOGIN_INTRO_SHRINK_MS);
    const doneT = setTimeout(() => onIntroComplete?.(), LOGIN_INTRO_TOTAL_MS + 80);
    return () => {
      clearTimeout(soundT);
      clearTimeout(doneT);
    };
  }, [onIntroComplete, rotate, scale, startScale]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  const dustSpecs = useMemo(() => DUST_SPECS, []);

  return (
    <View style={styles.stage}>
      <View pointerEvents="none" style={styles.dustLayer}>
        <HammerDustPuff puffColor={puffColor} />
        {dustSpecs.map((spec, i) => (
          <DustParticle key={i} spec={spec} color={dustColor} />
        ))}
      </View>
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image
          source={require('@/assets/Logo/kls_logo_2.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityRole="image"
          accessibilityLabel="Košarkaška liga Srbije"
        />
      </Animated.View>
    </View>
  );
}

export function useLoginContentReveal() {
  const titleOpacity = useSharedValue(0);
  const formOpacity = useSharedValue(0);

  useEffect(() => {
    titleOpacity.value = withDelay(
      LOGIN_INTRO_SHRINK_MS + 140,
      withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) }),
    );
    formOpacity.value = withDelay(
      LOGIN_INTRO_SHRINK_MS + LOGIN_INTRO_SETTLE_MS + 220,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
    );
  }, [formOpacity, titleOpacity]);

  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const formStyle = useAnimatedStyle(() => ({ opacity: formOpacity.value }));

  return { titleStyle, formStyle };
}

const styles = StyleSheet.create({
  stage: {
    width: LOGIN_LOGO_SIZE,
    height: LOGIN_LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dustLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dustParticle: {
    position: 'absolute',
  },
  dustPuff: {
    position: 'absolute',
    width: LOGIN_LOGO_SIZE * 0.95,
    height: LOGIN_LOGO_SIZE * 0.55,
    borderRadius: LOGIN_LOGO_SIZE,
  },
  dustRing: {
    position: 'absolute',
    width: LOGIN_LOGO_SIZE * 1.1,
    height: LOGIN_LOGO_SIZE * 0.5,
    borderRadius: LOGIN_LOGO_SIZE,
    borderWidth: 2,
  },
  logoWrap: {
    width: LOGIN_LOGO_SIZE,
    height: LOGIN_LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: LOGIN_LOGO_SIZE, height: LOGIN_LOGO_SIZE },
});
