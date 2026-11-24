import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { EmailCode } from '@/components/EmailCode';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { NoticeChoices } from '@/components/NoticeChoices';
import { Screen } from '@/components/Screen';
import { hasEmailContact, useRegistration } from '@/context/RegistrationContext';
import { useConsentDoc } from '@/lib/consent';
import { turnOnPush } from '@/lib/push';
import { colors, type } from '@/theme';

export default function ConvidadoScreen() {
  const { draft, update, enterAsGuest, confirmGuestCode } = useRegistration();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // E-mail que já é de um convidado (outro aparelho, app reinstalado): a volta pede o código (RF02).
  const [askCode, setAskCode] = useState(false);
  const doc = useConsentDoc('termos');
  const email = draft.email.trim();

  // O aceite vale para a versão vigente dos termos, que é a enviada no cadastro.
  useEffect(() => {
    if (doc.version !== draft.tcleVersion) update({ tcleVersion: doc.version });
  }, [doc.version, draft.tcleVersion, update]);

  async function finish() {
    if (draft.notices.push) await turnOnPush().catch(() => false);
    router.push('/conclusion');
  }

  async function enter() {
    update({ profile: 'convidado' });
    if (!email) {
      router.push('/conclusion');
      return;
    }
    if (!hasEmailContact(email)) {
      setError('Informe um e-mail válido. No perfil convidado, o contato é só por e-mail.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if ((await enterAsGuest()) === 'code') setAskCode(true);
      else await finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o e-mail.');
    } finally {
      setBusy(false);
    }
  }


  useEffect(() => {
    update({ profile: 'convidado' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (askCode) {
    return (
      <Screen>
        <View style={styles.brand}>
          <Logo />
          <Text style={styles.title}>Você já usou este e-mail</Text>
        </View>
        <EmailCode
          email={email}
          title="Volte ao seu acesso de convidado"
          body={`Digite o código de 6 dígitos que enviamos para ${email}. Suas preferências de aviso continuam as mesmas.`}
          confirmLabel="Entrar"
          laterLabel="Usar outro e-mail"
          verify={async (code) => {
            await confirmGuestCode(code);
            return {};
          }}
          resend={() => enterAsGuest()}
          onConfirmed={() => void finish()}
          onLater={() => setAskCode(false)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/welcome');
        }}
        style={styles.back}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={24} color={colors.ink} />
      </Pressable>

      <View style={styles.brand}>
        <Logo />
        <Text style={styles.title}>Quero apenas me informar</Text>
        <Text style={styles.subtitle}>Acesse conteúdos, estatísticas e centros sem cadastro clínico.</Text>
      </View>

      <View style={styles.info}>
        <View style={styles.infoIcon}>
          <Ionicons name="cube-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Acesso como convidado</Text>
          <Text style={styles.infoBody}>Sem dados físicos nem jornada. Avisos só se você quiser.</Text>
        </View>
      </View>

      <Field
        label="E-mail (opcional)"
        placeholder="voce@email.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={draft.email}
        onChangeText={(value) => update({ email: value, profile: 'convidado' })}
      />

      <Text style={styles.sectionTitle}>Quer receber avisos?</Text>
      {!email ? <Text style={styles.caption}>Informe um e-mail acima para escolher os avisos.</Text> : null}
      <NoticeChoices
        value={draft.notices}
        onChange={(notices) => update({ notices })}
        email={draft.email}
        disabled={!email}
      />

      <View style={styles.check}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.tcleAccepted }}
          onPress={() => update({ profile: 'convidado', tcleAccepted: !draft.tcleAccepted })}
          hitSlop={8}
        >
          <Ionicons
            name={draft.tcleAccepted ? 'checkbox' : 'square-outline'}
            size={22}
            color={draft.tcleAccepted ? colors.primary : colors.muted}
          />
        </Pressable>
        <Text style={styles.checkText}>
          Li e aceito os{' '}
          <Text style={styles.link} onPress={() => router.push('/terms')}>
            termos de uso
          </Text>
          .
        </Text>
      </View>

      <Text style={styles.caption}>
        Sem e-mail, nada é guardado. Com e-mail, ele fica guardado por 12 meses desde o seu último acesso, e você
        pode apagá-lo quando quiser em Perfil › Contato. Não pedimos telefone, CPF nem dados clínicos.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label={busy ? 'Enviando…' : 'Acessar aplicativo'} disabled={!draft.tcleAccepted || busy} onPress={enter} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 32, height: 32, justifyContent: 'center', marginLeft: -6 },
  brand: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  title: { ...type.heading, color: colors.ink, textAlign: 'center', marginTop: 8 },
  subtitle: { ...type.secondary, color: colors.muted, textAlign: 'center' },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F3F6FB',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: { ...type.body, fontWeight: '700', color: colors.ink },
  infoBody: { ...type.secondary, color: colors.muted, marginTop: 2 },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkText: { ...type.secondary, color: colors.ink, flex: 1 },
  link: { color: colors.primary, fontWeight: '600' },
  caption: { ...type.caption, color: colors.muted },
  sectionTitle: { ...type.body, fontWeight: '700', color: colors.ink },
  error: { ...type.caption, color: colors.danger },
});
