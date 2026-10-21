import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, type } from '@/theme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function Field({ label, hint, icon, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {icon ? <Ionicons name={icon} size={18} color={colors.muted} /> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          {...rest}
          style={[styles.input, rest.style]}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...type.secondary, color: colors.ink, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  input: {
    ...type.body,
    color: colors.ink,
    flex: 1,
    paddingVertical: 12,
  },
  hint: { ...type.caption, color: colors.muted },
});
