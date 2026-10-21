import { useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { ProgressDots } from '@/components/ProgressDots';
import { Screen } from '@/components/Screen';
import { colors, type } from '@/theme';

const slides = [
  {
    chip: 'Doador',
    copy: 'Sua atitude pode fazer a diferença.\nSeja um doador de células-tronco.',
    image: require('../../assets/illustrations/onboarding-doador.png'),
    chipBg: colors.chip,
    chipFg: colors.primary,
  },
  {
    chip: 'Receptor',
    copy: 'Você não está sozinho. Encontre apoio no\ntratamento com células-tronco.',
    image: require('../../assets/illustrations/onboarding-receptor.png'),
    chipBg: '#E7F6F0',
    chipFg: '#3D9B8F',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const indexRef = useRef(0);
  const widthRef = useRef(0);
  const startX = useRef(0);
  const offsetRef = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;

  function goTo(next: number) {
    const width = widthRef.current;
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    const toValue = -clamped * width;
    indexRef.current = clamped;
    offsetRef.current = toValue;
    setIndex(clamped);
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      friction: 8,
      tension: 64,
    }).start();
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          startX.current = value;
          offsetRef.current = value;
        });
        startX.current = offsetRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const width = widthRef.current || 1;
        const min = -width * (slides.length - 1);
        const next = Math.max(min - 28, Math.min(28, startX.current + gesture.dx));
        offsetRef.current = next;
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const width = widthRef.current || 1;
        let next = indexRef.current;
        if (gesture.dx < -width * 0.18 || gesture.vx < -0.35) next += 1;
        else if (gesture.dx > width * 0.18 || gesture.vx > 0.35) next -= 1;
        goTo(next);
      },
    }),
  ).current;

  function onPagerLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    if (width === widthRef.current) return;
    widthRef.current = width;
    setPageWidth(width);
    const x = -indexRef.current * width;
    offsetRef.current = x;
    translateX.setValue(x);
  }

  return (
    <Screen
      scroll={false}
      footer={<Button label="Continuar" onPress={() => router.push('/welcome')} />}
    >
      <View style={styles.hero}>
        <Logo />
        <Text style={styles.tagline}>{`Juntos por\nmais vidas`}</Text>

        <View
          style={styles.pager}
          onLayout={onPagerLayout}
          accessibilityRole="adjustable"
          accessibilityLabel="Tipo de perfil"
          accessibilityHint="Arraste para o lado para alternar entre doador e receptor"
          accessibilityValue={{
            min: 1,
            max: slides.length,
            now: index + 1,
            text: slides[index].chip,
          }}
          {...pan.panHandlers}
        >
          {pageWidth > 0 ? (
            <Animated.View
              testID="onboarding-pager"
              style={[
                styles.track,
                { width: pageWidth * slides.length, transform: [{ translateX }] },
              ]}
            >
              {slides.map((slide) => (
                <View key={slide.chip} style={[styles.page, { width: pageWidth }]}>
                  <Image
                    source={slide.image}
                    accessibilityLabel={slide.chip}
                    resizeMode="contain"
                    style={styles.art}
                  />
                  <View style={[styles.chip, { backgroundColor: slide.chipBg }]}>
                    <Text style={[styles.chipText, { color: slide.chipFg }]}>{slide.chip}</Text>
                  </View>
                  <Text style={styles.copy}>{slide.copy}</Text>
                </View>
              ))}
            </Animated.View>
          ) : null}
        </View>

        <ProgressDots count={slides.length} index={index} onChange={goTo} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', paddingTop: 24, gap: 16 },
  tagline: {
    ...type.title,
    color: colors.muted,
    textAlign: 'center',
    fontWeight: '600',
  },
  pager: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  track: {
    flex: 1,
    flexDirection: 'row',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  art: {
    width: 280,
    height: 220,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { ...type.secondary, fontWeight: '600' },
  copy: { ...type.body, color: colors.muted, textAlign: 'center', paddingHorizontal: 8 },
});
