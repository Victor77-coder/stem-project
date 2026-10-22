import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { useRegistration } from '@/context/RegistrationContext';
import { colors, type } from '@/theme';

export default function WelcomeScreen() {
  const { update, signIn } = useRegistration();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      router.replace('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
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

      <View style={styles.brand}>
        <Logo />
        <Text style={styles.title}>Bem-vindo(a) de volta!</Text>
        <Text style={styles.subtitle}>Faça seu login para continuar.</Text>
      </View>

      <Field
        label="Email ou CPF"
        placeholder="@gmail.com"
        icon="mail-outline"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Senha"
        placeholder="Entre com sua senha"
        icon="lock-closed-outline"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/forgot-password')}
        style={styles.forgot}
      >
        <Text style={styles.forgotText}>Esqueci a minha senha</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button label={busy ? 'Entrando…' : 'Entrar'} disabled={busy || !email.trim() || !password} onPress={enter} />

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>Ou acesse com</Text>
          <View style={styles.orLine} />
        </View>

        <Button
          label="Criar Conta"
          variant="secondary"
          onPress={() => {
            update({ profile: null });
            router.push('/profile');
          }}
        />
        <Button
          label="Quero apenas me informar"
          variant="secondary"
          onPress={() => {
            update({ profile: 'leigo', tcleAccepted: false });
            router.push('/leigo');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 32, height: 32, justifyContent: 'center', marginLeft: -6 },
  brand: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  title: { ...type.heading, color: colors.ink, textAlign: 'center', marginTop: 8 },
  subtitle: { ...type.body, color: colors.muted, textAlign: 'center' },
  forgot: { alignSelf: 'flex-end', marginTop: -8, paddingVertical: 4 },
  forgotText: { ...type.caption, color: colors.primary, fontWeight: '600' },
  error: { ...type.caption, color: colors.danger },
  actions: { gap: 12, marginTop: 8 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  orText: { ...type.caption, color: colors.muted },
});
