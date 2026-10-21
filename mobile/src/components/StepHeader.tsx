import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, type } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  step?: number;
  total?: number;
  brand?: ReactNode;
};

export function StepHeader({ title, subtitle, step, total, brand }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/onboarding');
          }}
          style={styles.back}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        {step && total ? (
          <Text style={styles.step}>
            Etapa {step} de {total}
          </Text>
        ) : (
          <View style={styles.spacer} />
        )}
        <View style={styles.spacer} />
      </View>
      {brand ? <View style={styles.brand}>{brand}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 32, height: 32, justifyContent: 'center', marginLeft: -6 },
  spacer: { width: 32, height: 32 },
  step: { ...type.caption, color: colors.muted, fontWeight: '600' },
  brand: { alignItems: 'center', paddingVertical: 8 },
  title: { ...type.heading, color: colors.ink, textAlign: 'center' },
  subtitle: { ...type.secondary, color: colors.muted, textAlign: 'center' },
});
