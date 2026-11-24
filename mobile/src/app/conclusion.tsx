import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { EmailCode } from '@/components/EmailCode';
import { Screen } from '@/components/Screen';
import { hasEmailContact, useRegistration, type ProfileType, type Sexo } from '@/context/RegistrationContext';
import { api } from '@/lib/api';
import { colors, type } from '@/theme';

type Step = { icon: keyof typeof Ionicons.glyphMap; text: string };
type Channels = { push: boolean; email: boolean };

/** O passo dos avisos segue o que ficou ligado de fato: o push depende da permissão do sistema e o e-mail, do código. */
function noticeStep(channels: Channels, emailPending: boolean): Step {
  const on = [channels.push && 'celular', channels.email && 'e-mail'].filter((item): item is string => Boolean(item));
  if (on.length) return { icon: 'notifications', text: `Avisos ativados: ${on.join(' e ')}` };
  if (emailPending) return { icon: 'mail-unread-outline', text: 'Confirme seu e-mail em Perfil › Notificações para receber avisos' };
  return { icon: 'notifications-outline', text: 'Ative avisos de campanhas em Perfil › Notificações' };
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? '';
}

function profileNoun(profile: ProfileType | null, sex: Sexo) {
  if (profile === 'convidado') return 'Convidado';
  if (profile === 'receptor') return sex === 'feminino' ? 'Receptora' : 'Receptor';
  return sex === 'feminino' ? 'Doadora' : 'Doador';
}

function nextSteps(profile: ProfileType | null): Step[] {
  if (profile === 'convidado') {
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
    ];
  }
  return [
    { icon: 'git-branch-outline', text: 'Conheça as 6 etapas da doação' },
    { icon: 'location-outline', text: 'Encontre o hemocentro mais próximo' },
  ];
}

export default function ConclusionScreen() {
  const { draft, signedIn, emailConfirmed, setEmailConfirmed } = useRegistration();
  const [later, setLater] = useState(false);
  const [channels, setChannels] = useState<Channels | null>(null);
  const name = firstName(draft.name);
  const noun = profileNoun(draft.profile, draft.sex);
  const emailPending = draft.notices.email && hasEmailContact(draft.email) && !emailConfirmed;
  const askCode = signedIn && emailPending && !later;

  // Convidado sem contato não cria conta: sem canais, sem passo de avisos.
  useEffect(() => {
    if (!signedIn) return;
    api<Channels>('/me/preferences/')
      .then(({ push, email }) => setChannels({ push, email }))
      .catch(() => setChannels(null));
  }, [signedIn, emailConfirmed]);

  const steps = channels ? [...nextSteps(draft.profile), noticeStep(channels, emailPending)] : nextSteps(draft.profile);

  const subtitle =
    draft.profile === 'convidado'
      ? 'Seu acesso educacional está pronto. Explore conteúdos, estatísticas e centros perto de você.'
      : `Seu perfil de ${noun} foi criado. Agora você pode acompanhar sua jornada e encontrar centros perto de você.`;

  return (
    <Screen
      scroll={askCode}
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

        {askCode ? (
          <EmailCode email={draft.email.trim()} onConfirmed={() => setEmailConfirmed(true)} onLater={() => setLater(true)} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Próximos passos</Text>
            {steps.map((step) => (
              <View key={step.text} style={styles.stepRow}>
                <Ionicons name={step.icon} size={18} color={colors.primary} />
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        )}
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
