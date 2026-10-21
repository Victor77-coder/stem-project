import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useRegistration, type ProfileType, type Sexo } from '@/context/RegistrationContext';
import { colors, type } from '@/theme';

type Step = { icon: keyof typeof Ionicons.glyphMap; text: string };

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? '';
}

function profileNoun(profile: ProfileType | null, sex: Sexo) {
  if (profile === 'leigo') return 'público leigo';
  if (profile === 'receptor') return sex === 'feminino' ? 'Receptora' : 'Receptor';
  return sex === 'feminino' ? 'Doadora' : 'Doador';
}

function nextSteps(profile: ProfileType | null): Step[] {
  if (profile === 'leigo') {
    return [
      { icon: 'book-outline', text: 'Explore os conteúdos educativos' },
      { icon: 'location-outline', text: 'Encontre centros perto de você' },
      { icon: 'stats-chart-outline', text: 'Veja as estatísticas do STEM' },
    ];
  }
  if (profile === 'receptor') {
    return [
      { icon: 'git-branch-outline', text: 'Conheça as etapas do transplante' },
      { icon: 'location-outline', text: 'Encontre o centro mais próximo' },
      { icon: 'notifications-outline', text: 'Ative avisos de campanhas' },
    ];
  }
  return [
    { icon: 'git-branch-outline', text: 'Conheça as 6 etapas da doação' },
    { icon: 'location-outline', text: 'Encontre o hemocentro mais próximo' },
    { icon: 'notifications-outline', text: 'Ative avisos de campanhas' },
  ];
}

export default function ConclusionScreen() {
  const { draft } = useRegistration();
  const name = firstName(draft.name);
  const noun = profileNoun(draft.profile, draft.sex);
  const steps = nextSteps(draft.profile);

  const subtitle =
    draft.profile === 'leigo'
      ? 'Seu acesso educacional está pronto. Explore conteúdos, estatísticas e centros perto de você.'
      : `Seu perfil de ${noun} foi criado. Agora você pode acompanhar sua jornada e encontrar centros perto de você.`;

  return (
    <Screen
      scroll={false}
      footer={
        <Button
          label="Ir para o início"
          onPress={() => router.replace('/home')}
        />
      }
    >
      <View style={styles.center}>
        <View style={styles.badge}>
          <Ionicons name="checkmark" size={40} color={colors.success} />
        </View>
        <Text style={styles.title}>{name ? `Tudo pronto, ${name}!` : 'Tudo pronto!'}</Text>
        <Text style={styles.body}>{subtitle}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Próximos passos</Text>
          {steps.map((step) => (
            <View key={step.text} style={styles.stepRow}>
              <Ionicons name={step.icon} size={18} color={colors.primary} />
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 4 },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E7F6EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#515B6C',
    textAlign: 'center',
    marginBottom: 8,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.ink },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepText: { ...type.secondary, color: colors.ink, flex: 1 },
});
