import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '@/components/Logo';
import { NavPair } from '@/components/NavPair';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { useRegistration } from '@/context/RegistrationContext';
import { colors, type } from '@/theme';

export default function TermsScreen() {
  const { draft, update, isLeigo } = useRegistration();

  function goNext() {
    if (isLeigo) {
      if (router.canGoBack()) router.back();
      else router.replace('/leigo');
      return;
    }
    router.push('/physical');
  }

  return (
    <Screen
      footer={
        <NavPair
          onLeft={() => {
            if (router.canGoBack()) router.back();
            else router.replace(isLeigo ? '/leigo' : '/register');
          }}
          onRight={goNext}
          rightDisabled={!draft.tcleAccepted}
        />
      }
    >
      <StepHeader
        title={isLeigo ? 'Termos de uso' : 'Consentimento'}
        subtitle={isLeigo ? 'Leia e aceite o termo para continuar.' : 'Leia e aceite o termo para concluir.'}
        step={isLeigo ? undefined : 3}
        total={isLeigo ? undefined : 5}
        brand={<Logo />}
      />

      <View style={styles.card}>
        <View style={styles.docIcon}>
          <Ionicons name="document-text" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>
            {isLeigo ? 'Termos de uso' : 'Termo de Consentimento Livre e Esclarecido (TCLE)'}
          </Text>
          <Text style={styles.cardMeta}>Versão {draft.tcleVersion} · leitura obrigatória antes dos seus dados</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: draft.tcleAccepted }}
        onPress={() => update({ tcleAccepted: !draft.tcleAccepted })}
        style={styles.check}
      >
        <Ionicons
          name={draft.tcleAccepted ? 'checkbox' : 'square-outline'}
          size={22}
          color={draft.tcleAccepted ? colors.primary : colors.muted}
        />
        <Text style={styles.checkText}>
          {isLeigo
            ? 'Li e aceito os termos de uso.'
            : 'Li e aceito o termo de consentimento Livre e Esclarecido (TCLE)'}
        </Text>
      </Pressable>

      <Pressable accessibilityRole="link" onPress={() => router.push('/tcle')}>
        <Text style={styles.link}>Ler o documento na íntegra</Text>
      </Pressable>

      <Text style={styles.caption}>O aceite é obrigatório para concluir o cadastro.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F3F6FB',
    alignItems: 'center',
  },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...type.secondary, fontWeight: '700', color: colors.ink },
  cardMeta: { ...type.caption, color: colors.muted, marginTop: 4 },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkText: { ...type.secondary, color: colors.ink, flex: 1 },
  link: { ...type.secondary, color: colors.primary, fontWeight: '600' },
  caption: { ...type.caption, color: colors.muted },
});
