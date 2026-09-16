import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface Props {
  onDone: () => void;
  // La pantalla de login siempre respeta "reducir movimiento" del sistema —
  // pero el botón "Ver animación" de /branding es un pedido explícito y
  // puntual del dueño de la app, así que ahí se fuerza a reproducir de
  // todas formas (si no, nunca podría verla en un dispositivo con esa
  // preferencia activada).
  forcePlay?: boolean;
  // La planta es puramente decorativa y no molesta a nada — en el login
  // (no en la vista previa de /branding, que sí debe cerrarse del todo) se
  // queda de fondo para siempre en vez de desaparecer junto con la
  // inundación verde y el logo. Ver AuthScreen.tsx.
  persistPlant?: boolean;
}

const STEM_LENGTH = 140;
// Más lento y con fases claramente separadas: primero crece la planta sola
// (con una pausa al terminar para que se note que ya terminó esa etapa),
// después la inundación verde, y solo al final — con la pantalla ya verde —
// aparece el logo. Antes todo pasaba en 3.2s con la planta y el logo casi
// superpuestos; ahora son ~6.3s con una secuencia perceptible.
const GROW_DURATION = 6300;
const EXIT_DURATION = 400;

// Animación de una semilla que crece y llena la pantalla de verde — la
// metáfora de "ir creciendo financieramente" que le da nombre a Kipo. Sin
// react-native-reanimated/lottie/skia en el proyecto: se construye con
// Animated (RN) + react-native-svg, ya instalados, mismo enfoque que el
// hover-lift que ya existe en AuthScreen.tsx.
export function SeedGrowthIntro({ onDone, forcePlay = false, persistPlant = false }: Props) {
  const { height: screenH, width: screenW } = Dimensions.get('window');
  const progress = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const [skipped, setSkipped] = useState(false);
  const [finished, setFinished] = useState(false);

  const finish = (instant: boolean) => {
    setFinished(true);
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
        // Lineal a propósito: las fases de abajo (planta, pausa, inundación,
        // logo) están repartidas por fracción de tiempo transcurrido — un
        // easing no lineal en este driver corría la inundación mucho antes
        // de lo previsto (con inOut/cubic, al 62% del tiempo ya iba por
        // ~78% de progreso). El "sentir" de cada etapa ya sale de sus
        // propias curvas de interpolate, no hace falta acá también.
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        if (!cancelled) finish(false);
      });
    };

    if (forcePlay) {
      runGrowth();
      return () => {
        cancelled = true;
      };
    }

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
  }, [forcePlay]);

  const skip = () => {
    if (skipped) return;
    setSkipped(true);
    progress.stopAnimation();
    Animated.timing(progress, { toValue: 1, duration: 200, useNativeDriver: false }).start(() => finish(false));
  };

  // Etapa 1 — la planta crece sola (0 → 0.62 del tiempo total).
  const seedOpacity = progress.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const stemDashoffset = progress.interpolate({
    inputRange: [0, 0.05, 0.42, 1],
    outputRange: [STEM_LENGTH, STEM_LENGTH, 0, 0],
    extrapolate: 'clamp',
  });
  const leavesOpacity = progress.interpolate({ inputRange: [0, 0.34, 0.5, 1], outputRange: [0, 0, 1, 1], extrapolate: 'clamp' });
  const leavesTransform = progress.interpolate({
    inputRange: [0.34, 0.5],
    outputRange: ['scale(0.4)', 'scale(1)'],
    extrapolate: 'clamp',
  });
  // Segundo par de hojas, más arriba del tallo, un poco más chico — aparece
  // justo después del primer par para que la planta se vea más llena sin
  // que todas las hojas salgan de golpe.
  const upperLeavesOpacity = progress.interpolate({ inputRange: [0, 0.4, 0.56, 1], outputRange: [0, 0, 1, 1], extrapolate: 'clamp' });
  const upperLeavesTransform = progress.interpolate({
    inputRange: [0.4, 0.56],
    outputRange: ['scale(0.4)', 'scale(1)'],
    extrapolate: 'clamp',
  });
  // 0.56 → 0.62: pausa — la planta ya está completa y se queda quieta un
  // momento antes de que arranque la inundación, para que se perciba como
  // una etapa terminada y no un paso más de un mismo movimiento continuo.

  // Etapa 2 — inundación verde (0.62 → 0.9).
  const floodMaxScale = Math.ceil((Math.max(screenH, screenW) * 2.4) / 24);
  const floodScale = progress.interpolate({
    inputRange: [0.62, 0.9, 1],
    outputRange: [0, floodMaxScale, floodMaxScale],
    extrapolate: 'clamp',
  });

  // Etapa 3 — el logo aparece recién con la pantalla ya verde (0.88 → 1).
  const wordmarkOpacity = progress.interpolate({ inputRange: [0, 0.88, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });

  // La planta crece a un lado, no en el centro — la tarjeta de login (que
  // ocupa casi todo el ancho en un teléfono) se oculta mientras dura la
  // intro (ver AuthScreen.tsx: opacity 0 hasta introDone), así que este
  // costado queda despejado de verdad, no apretado contra la tarjeta.
  const plantLeft = screenW * 0.16;

  // Si la planta se queda de fondo para siempre, solo la inundación+logo se
  // desvanecen (este wrapper); si no, la salida es la de siempre — todo
  // junto, incluida la planta — para no dejarla "pop" de golpe cuando el
  // padre la desmonta (ver branding.tsx, que cierra la vista previa entera
  // apenas termina).
  const transientOpacity = persistPlant ? exitOpacity : 1;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, { opacity: persistPlant ? 1 : exitOpacity }]}
      pointerEvents={finished ? 'none' : 'auto'}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityLabel="Saltar animación">
        <Animated.View style={{ opacity: transientOpacity }}>
          {/* Inundación verde: círculo pequeño anclado a la base de la planta que escala hasta cubrir toda la pantalla. */}
          <Animated.View
            style={[
              styles.flood,
              {
                left: plantLeft + 28,
                bottom: screenH * 0.32 - 12,
                transform: [{ scale: floodScale }],
              },
            ]}
          />

          <Animated.View style={[styles.wordmarkWrap, { opacity: wordmarkOpacity }]}>
            <Animated.Text style={styles.wordmark}>Kipo</Animated.Text>
          </Animated.View>
        </Animated.View>

        <Svg
          width={64}
          height={STEM_LENGTH + 40}
          viewBox="0 0 64 180"
          style={[styles.plantWrap, { left: plantLeft, bottom: screenH * 0.28 }]}
        >
          <AnimatedPath
            d={`M32 ${STEM_LENGTH + 40} L32 40`}
            stroke={colors.card}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={STEM_LENGTH}
            strokeDashoffset={stemDashoffset}
            fill="none"
          />
          <AnimatedG opacity={leavesOpacity} transform={leavesTransform}>
            <Path d="M32 55 C 12 45, 2 55, 0 70 C 20 72, 30 65, 32 55 Z" fill={colors.gold} />
            <Path d="M32 65 C 52 55, 62 65, 64 80 C 44 82, 34 75, 32 65 Z" fill={colors.gold} />
          </AnimatedG>
          <AnimatedG opacity={upperLeavesOpacity} transform={upperLeavesTransform}>
            <Path d="M32 42 C 16 34, 8 42, 6 54 C 22 56, 30 50, 32 42 Z" fill={colors.gold} />
            <Path d="M32 48 C 48 40, 56 48, 58 60 C 42 62, 34 56, 32 48 Z" fill={colors.gold} />
          </AnimatedG>
          <AnimatedCircle cx={32} cy={STEM_LENGTH + 32} r={9} fill={colors.gold} opacity={seedOpacity} />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  // primaryDeep (verde bosque oscuro), no primary (ahora un verde vivo
  // pensado para acentos interactivos, no para una inundación de pantalla
  // completa) — así el flood termina en el mismo tono en el que arranca el
  // degradado de LoginBackdrop, sin salto de color.
  flood: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryDeep },
  plantWrap: { position: 'absolute' },
  // `position:'absolute'` sin top/left explícitos ignora el alignItems/
  // justifyContent del padre — con StyleSheet.absoluteFill (inset 0) sí
  // ocupa toda la pantalla y ahí adentro el texto queda centrado de verdad.
  wordmarkWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
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
