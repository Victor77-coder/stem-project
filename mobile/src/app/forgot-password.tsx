import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { colors, type } from '@/theme';

type Step = 'email' | 'code' | 'password' | 'done';

const TEXT_SECONDARY = '#515B6C';
const MINT = '#E7F6EE';
const RESEND_SECONDS = 45;

function maskContact(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes('@')) {
    const [local, domain] = trimmed.split('@');
    const first = local.charAt(0) || '•';
    return `${first}•••@${domain}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 2) return `•••${digits.slice(-2)}`;
  return trimmed || 'seu contato';
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codeInputRef = useRef<TextInput>(null);

  async function call(path: string, body: Record<string, string>, next?: Step) {
    setBusy(true);
    setError('');
    try {
      await api(path, { method: 'POST', body: { identifier: contact, ...body }, auth: false });
      if (next) setStep(next);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir agora.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step !== 'code') return;
    setSecondsLeft(RESEND_SECONDS);
    const id = setInterval(() => {
      setSecondsLeft((n) => (n > 0 ? n - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (step !== 'code') return;
    const id = setTimeout(() => codeInputRef.current?.focus(), 200);
    return () => clearTimeout(id);
  }, [step]);

  const hasMin = password.length >= 8;
  const hasUpper = /[A-ZÀ-Ý]/.test(password);
  const hasNumber = /\d/.test(password);
  const canSave = hasMin && hasUpper && hasNumber && password === confirm && confirm.length > 0;

  function goBack() {
    setError('');
    if (step === 'code') {
      setStep('email');
      return;
    }
    if (step === 'password') {
      setStep('code');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  }

  if (step === 'done') {
    return (
      <Screen
        scroll={false}
        footer={<Button label="Voltar para o login" onPress={() => router.replace('/welcome')} />}
      >
        <View style={styles.done}>
          <View style={styles.badge}>
            <Ionicons name="lock-closed-outline" size={40} color={colors.success} />
          </View>
          <Text style={styles.title}>Senha redefinida!</Text>
          <Text style={styles.subtitle}>
            Sua senha foi alterada com sucesso. Use a nova senha para entrar.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={goBack}
        style={styles.back}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={24} color={colors.ink} />
      </Pressable>

      <View style={styles.brand}>
        <Logo />
        {step === 'email' ? (
          <>
            <Text style={styles.title}>Esqueceu sua senha?</Text>
            <Text style={styles.subtitle}>
              Informe seu e-mail ou CPF. Enviaremos um código para redefinir o acesso.
            </Text>
          </>
        ) : null}
        {step === 'code' ? (
          <>
            <Text style={styles.title}>Digite o código</Text>
            <Text style={styles.subtitle}>
              Enviamos um código de 6 dígitos para {maskContact(contact)}
            </Text>
          </>
        ) : null}
        {step === 'password' ? (
          <>
            <Text style={styles.title}>Crie uma nova senha</Text>
            <Text style={styles.subtitle}>
              Use uma senha forte que você não utiliza em outros serviços.
            </Text>
          </>
        ) : null}
      </View>

      {step === 'email' ? (
        <>
          <Field
            label="Email ou CPF"
            placeholder="seuemail@gmail.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={contact}
            onChangeText={setContact}
          />
          <Button
            label="Enviar código"
            disabled={contact.trim().length < 3 || busy}
            onPress={() => {
              setCode('');
              void call('/auth/password/forgot/', {}, 'code');
            }}
          />
          <View style={styles.info}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={styles.infoText}>Por segurança, o STEM nunca pede sua senha do Gov.br.</Text>
          </View>
        </>
      ) : null}

      {step === 'code' ? (
        <>
          <View style={styles.otpWrap}>
            <View style={styles.otpRow} pointerEvents="none">
              {Array.from({ length: 6 }).map((_, index) => {
                const filled = Boolean(code[index]);
                const active = code.length === index || (code.length === 6 && index === 5);
                return (
                  <View
                    key={index}
                    style={[styles.otpBox, filled && styles.otpBoxFilled, active && styles.otpBoxActive]}
                  >
                    <Text style={styles.otpDigit}>{code[index] ?? ''}</Text>
                  </View>
                );
              })}
            </View>
            <TextInput
              ref={codeInputRef}
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              caretHidden
              accessibilityLabel="Código de 6 dígitos"
              style={styles.otpInput}
            />
          </View>
          <Button
            label="Verificar"
            disabled={code.length < 6 || busy}
            onPress={() => void call('/auth/password/verify/', { code }, 'password')}
          />
          <Text style={styles.resend}>
            {secondsLeft > 0 ? (
              `Não recebeu? Reenviar em ${formatTimer(secondsLeft)}`
            ) : (
              <>
                Não recebeu?{' '}
                <Text
                  style={styles.resendLink}
                  onPress={() => {
                    setCode('');
                    setSecondsLeft(RESEND_SECONDS);
                    codeInputRef.current?.focus();
                    void call('/auth/password/forgot/', {});
                  }}
                >
                  Reenviar
                </Text>
              </>
            )}
          </Text>
        </>
      ) : null}

      {step === 'password' ? (
        <>
          <Field
            label="Nova senha"
            placeholder="Mínimo de 8 caracteres"
            icon="lock-closed-outline"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Field
            label="Confirmar nova senha"
            placeholder="Repita a nova senha"
            icon="lock-closed-outline"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />
          <View style={styles.rules}>
            <Rule ok={hasMin} label="Pelo menos 8 caracteres" />
            <Rule ok={hasUpper} label="Uma letra maiúscula" />
            <Rule ok={hasNumber} label="Um número" />
          </View>
          <Button
            label="Salvar nova senha"
            disabled={!canSave || busy}
            onPress={() => void call('/auth/password/reset/', { code, password }, 'done')}
          />
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.ruleRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close'}
        size={18}
        color={ok ? colors.success : colors.muted}
      />
      <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { width: 32, height: 32, justifyContent: 'center', marginLeft: -6 },
  brand: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  info: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'flex-start',
  },
  infoText: { ...type.secondary, color: colors.primary, flex: 1 },
  otpWrap: { position: 'relative', minHeight: 56, justifyContent: 'center' },
  otpRow: { flexDirection: 'row', gap: 8 },
  otpBox: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: { backgroundColor: colors.bg, borderColor: colors.line },
  otpBoxActive: {
    backgroundColor: colors.bg,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  otpDigit: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.ink },
  otpInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.02,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 16,
  },
  resend: { ...type.caption, color: TEXT_SECONDARY, textAlign: 'center' },
  resendLink: { color: colors.primary, fontWeight: '700' },
  error: { ...type.caption, color: colors.danger, textAlign: 'center' },
  rules: {
    borderRadius: 16,
    backgroundColor: colors.field,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { ...type.secondary, color: colors.muted },
  ruleTextOk: { color: colors.success, fontWeight: '600' },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 8 },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: MINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
