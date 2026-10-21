import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { colors, space, type } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = PressableProps & {
  label: string;
  variant?: Variant;
};

export function Button({ label, variant = 'primary', disabled, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        pressed && { opacity: 0.86 },
        disabled && { opacity: 0.45 },
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.label,
          variant === 'secondary' && { color: colors.primary },
          variant === 'ghost' && { color: colors.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: space.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: { backgroundColor: 'transparent' },
  label: { ...type.button, color: '#fff' },
});
