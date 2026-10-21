import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { useRegistration } from '@/context/RegistrationContext';
import { colors, type } from '@/theme';

export default function LeigoScreen() {
  const { draft, update } = useRegistration();

  useEffect(() => {
    update({ profile: 'leigo' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <Text style={styles.infoTitle}>Acesso como público leigo</Text>
          <Text style={styles.infoBody}>Sem dados físicos, jornada ou alertas.</Text>
        </View>
      </View>

      <Field
        label="Email ou Contato"
        placeholder="Email ou Contato"
        autoCapitalize="none"
        keyboardType="email-address"
        value={draft.email}
        onChangeText={(email) => update({ email, profile: 'leigo' })}
      />

      <View style={styles.check}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.tcleAccepted }}
          onPress={() => update({ profile: 'leigo', tcleAccepted: !draft.tcleAccepted })}
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
        O contato pode ser incluído ou alterado depois. Não são solicitados peso, altura, sexo biológico,
        comorbidades ou TCLE.
      </Text>

      <Button
        label="Acessar aplicativo"
        disabled={!draft.tcleAccepted}
        onPress={() => {
          update({ profile: 'leigo' });
          router.push('/conclusion');
        }}
      />
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
});
