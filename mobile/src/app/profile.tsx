import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '@/components/Logo';
import { NavPair } from '@/components/NavPair';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { useRegistration, type ProfileType } from '@/context/RegistrationContext';
import { colors, type } from '@/theme';

const options: {
  id: Exclude<ProfileType, 'leigo'>;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconFg: string;
}[] = [
  {
    id: 'doador',
    title: 'Quero ser Doador',
    body: 'Pessoa interessada em se cadastrar como doadora.',
    icon: 'heart',
    iconBg: colors.chip,
    iconFg: colors.primary,
  },
  {
    id: 'receptor',
    title: 'Preciso de Tratamento (Receptor)',
    body: 'Pessoa que necessita de tratamento com células-tronco.',
    icon: 'medkit',
    iconBg: '#E7F6F0',
    iconFg: '#3D9B8F',
  },
];

export default function ProfileScreen() {
  const { draft, update } = useRegistration();

  useEffect(() => {
    if (draft.profile !== 'doador' && draft.profile !== 'receptor') {
      update({ profile: 'doador' });
    }
    // Só preenche o padrão na entrada da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = draft.profile === 'receptor' ? 'receptor' : 'doador';

  return (
    <Screen
      footer={
        <NavPair
          leftLabel="Cancelar"
          onLeft={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/welcome');
          }}
          onRight={() => router.push('/register')}
        />
      }
    >
      <StepHeader
        title="Escolha seu perfil"
        subtitle="Selecione uma das opções abaixo."
        step={1}
        total={5}
        brand={<Logo />}
      />
      <Text style={styles.hint}>Selecione o perfil que corresponde à sua necessidade.</Text>

      <View style={styles.list}>
        {options.map((item) => {
          const on = selected === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => update({ profile: item.id })}
              style={[styles.card, on && styles.cardOn]}
            >
              <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={20} color={item.iconFg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
              </View>
              <Ionicons
                name={on ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={on ? colors.primary : colors.line}
              />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...type.caption, color: colors.muted, textAlign: 'center', marginTop: -8 },
  list: { gap: 12, marginTop: 8 },
  card: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  cardOn: { borderColor: colors.primary },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.ink },
  cardBody: { ...type.caption, color: colors.muted, marginTop: 2 },
});
