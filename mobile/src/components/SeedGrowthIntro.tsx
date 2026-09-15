import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface Props {
  onDone: () => void;
}

const STEM_LENGTH = 140;
const GROW_DURATION = 3200;
const EXIT_DURATION = 350;

// Animación de una semilla que crece y llena la pantalla de verde — la
// metáfora de "ir creciendo financieramente" que le da nombre a Kipo. Sin
// react-native-reanimated/lottie/skia en el proyecto: se construye con
// Animated (RN) + react-native-svg, ya instalados, mismo enfoque que el
// hover-lift que ya existe en AuthScreen.tsx.
export function SeedGrowthIntro({ onDone }: Props) {
  const { height: screenH, width: screenW } = Dimensions.get('window');
  const progress = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const [skipped, setSkipped] = useState(false);

  const finish = (instant: boolean) => {
    if (instant) {
      onDone();
      return;
    }
    Animated.timing(exitOpacity, { toValue: 0, duration: EXIT_DURATION, useNativeDriver: false }).start(onDone);
  };

  useEffect(() => {
    let cancelled = false;
    const runGrowth = () => {
      Animated.timing(progress, {
        toValue: 1,
        duration: GROW_DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        if (!cancelled) finish(false);
      });
    };

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) finish(true);
        else runGrowth();
      })
      .catch(() => {
        if (!cancelled) runGrowth();
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    if (skipped) return;
    setSkipped(true);
    progress.stopAnimation();
    Animated.timing(progress, { toValue: 1, duration: 200, useNativeDriver: false }).start(() => finish(false));
  };

  const seedOpacity = progress.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const stemDashoffset = progress.interpolate({
    inputRange: [0, 0.05, 0.45, 1],
    outputRange: [STEM_LENGTH, STEM_LENGTH, 0, 0],
    extrapolate: 'clamp',
  });
  const leavesOpacity = progress.interpolate({ inputRange: [0, 0.35, 0.55, 1], outputRange: [0, 0, 1, 1], extrapolate: 'clamp' });
  const leavesTransform = progress.interpolate({
    inputRange: [0.35, 0.55],
    outputRange: ['scale(0.4)', 'scale(1)'],
    extrapolate: 'clamp',
  });
  const floodMaxScale = Math.ceil((Math.max(screenH, screenW) * 2.4) / 24);
  const floodScale = progress.interpolate({
    inputRange: [0.5, 0.88, 1],
    outputRange: [0, floodMaxScale, floodMaxScale],
    extrapolate: 'clamp',
  });
  const wordmarkOpacity = progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity: exitOpacity }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityLabel="Saltar animación">
        {/* Inundación verde: círculo pequeño anclado a la base que escala hasta cubrir toda la pantalla. */}
        <Animated.View
          style={[
            styles.flood,
            {
              left: screenW / 2 - 12,
              bottom: screenH * 0.32 - 12,
              transform: [{ scale: floodScale }],
            },
          ]}
        />

        <Animated.View style={[styles.wordmarkWrap, { opacity: wordmarkOpacity }]}>
          <Animated.Text style={styles.wordmark}>Kipo</Animated.Text>
        </Animated.View>

        <Svg
          width={80}
          height={STEM_LENGTH + 40}
          viewBox={`0 0 80 ${STEM_LENGTH + 40}`}
          style={[styles.plantWrap, { bottom: screenH * 0.28 }]}
        >
          <AnimatedPath
            d={`M40 ${STEM_LENGTH + 40} L40 40`}
            stroke={colors.card}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={STEM_LENGTH}
            strokeDashoffset={stemDashoffset}
            fill="none"
          />
          <AnimatedG opacity={leavesOpacity} transform={leavesTransform}>
            <Path d="M40 55 C 20 45, 10 55, 8 70 C 28 72, 38 65, 40 55 Z" fill={colors.gold} />
            <Path d="M40 65 C 60 55, 70 65, 72 80 C 52 82, 42 75, 40 65 Z" fill={colors.gold} />
          </AnimatedG>
          <AnimatedCircle cx={40} cy={STEM_LENGTH + 32} r={9} fill={colors.gold} opacity={seedOpacity} />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  flood: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary },
  plantWrap: { position: 'absolute', alignSelf: 'center' },
  wordmarkWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  wordmark: {
    fontFamily: fonts.displayBlack,
    fontSize: 40,
    color: '#fff',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
