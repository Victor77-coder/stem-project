import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { colors, type } from '@/theme';

type Props = {
  email: string;
  /** Chamado com as preferências que o servidor devolve depois de confirmar. */
  onConfirmed: (prefs: Record<string, unknown>) => void;
  onLater?: () => void;
};

/** Confirmação do e-mail por código de 6 dígitos: só depois disso o canal e-mail passa a valer. */
export function EmailCode({ email, onConfirmed, onLater }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      onConfirmed(await api<Record<string, unknown>>('/me/email/confirmar/', { method: 'POST', body: { code } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido ou expirado.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    try {
      await api('/me/email/codigo/', { method: 'POST' });
      setMessage('Enviamos um novo código.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reenviar agora.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Confirme seu e-mail</Text>
      <Text style={styles.body}>Digite o código de 6 dígitos que enviamos para {email}. Os avisos por e-mail começam depois disso.</Text>
      <TextInput
        accessibilityLabel="Código de 6 dígitos"
        placeholder="000000"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : message ? <Text style={styles.hint}>{message}</Text> : null}
      <Button label={busy ? 'Confirmando…' : 'Confirmar e-mail'} disabled={busy || code.length !== 6} onPress={confirm} />
      <View style={styles.links}>
        <Pressable accessibilityRole="button" onPress={resend} hitSlop={8}>
          <Text style={styles.link}>Reenviar código</Text>
        </Pressable>
        {onLater ? (
          <Pressable accessibilityRole="button" onPress={onLater} hitSlop={8}>
            <Text style={styles.link}>Confirmar depois</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.ink },
  body: { ...type.secondary, color: colors.textSecondary },
  input: {
    minHeight: 52,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.ink,
  },
  hint: { ...type.caption, color: colors.success },
  error: { ...type.caption, color: colors.danger },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: colors.primary600 },
});
