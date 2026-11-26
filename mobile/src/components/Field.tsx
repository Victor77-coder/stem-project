import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, type } from '@/theme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Mostra o * no rótulo. */
  required?: boolean;
  /** Mensagem de validação: substitui a dica e destaca o campo. */
  error?: string;
};

/** Rótulo de campo; com `required`, ganha o * de obrigatório. */
export function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={styles.label} accessibilityLabel={required ? `${text}, obrigatório` : text}>
      {text}
      {required ? <Text style={styles.star}> *</Text> : null}
    </Text>
  );
}

export function FieldError({ text }: { text?: string }) {
  return text ? (
    <Text style={styles.error} accessibilityRole="alert">
      {text}
    </Text>
  ) : null;
}

export function Field({ label, hint, icon, required, error, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <FieldLabel text={label} required={required} />
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.muted} /> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          {...rest}
          style={[styles.input, rest.style]}
        />
      </View>
      {error ? <FieldError text={error} /> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
  star: { color: colors.danger },
  inputError: { borderColor: colors.danger },
  error: { ...type.caption, color: colors.danger },
});
