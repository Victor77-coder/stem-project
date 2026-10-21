import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useRegistration } from '@/context/RegistrationContext';
import { colors, type } from '@/theme';

const SECTIONS = [
  {
    title: '1. Finalidade',
    body: 'Seus dados serão usados apenas para personalizar conteúdos educativos, mostrar centros próximos e organizar sua jornada informativa no STEM Project.',
  },
  {
    title: '2. Dados coletados',
    body: 'Peso, altura, sexo biológico, comorbidades e CEP. Coletamos apenas o mínimo necessário (LGPD, art. 6º).',
  },
  {
    title: '3. O que o app NÃO faz',
    body: 'Não realiza validação clínica, não agenda consultas e não garante compatibilidade. A compatibilidade é avaliada por dois médicos do SUS.',
  },
  {
    title: '4. Seus direitos',
    body: 'Você pode consultar, corrigir e solicitar a inativação dos seus dados a qualquer momento em Perfil › Privacidade.',
  },
];

export default function TcleDocumentScreen() {
  const { update } = useRegistration();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/terms');
  }

  return (
    <Screen
      footer={
        <Button
          label="Li e aceito o termo"
          onPress={() => {
            update({ tcleAccepted: true });
            goBack();
          }}
        />
      }
    >
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={goBack}
          style={styles.back}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.navTitle}>Termo de consentimento</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.chip}>
        <Text style={styles.chipText}>Versão 1.0 · 01/10/2026</Text>
      </View>

      <Text style={styles.title}>Termo de Consentimento Livre e Esclarecido</Text>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}

      <View style={styles.note}>
        <Ionicons name="document-text-outline" size={20} color={colors.muted} />
        <Text style={styles.noteText}>
          Registro do aceite: versão do termo, data e hora são armazenados para auditoria.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  back: { width: 32, height: 32, justifyContent: 'center', marginLeft: -6 },
  spacer: { width: 32, height: 32 },
  navTitle: { ...type.body, fontWeight: '700', color: colors.ink, textAlign: 'center', flex: 1 },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: { ...type.caption, color: colors.primary, fontWeight: '600' },
  title: { ...type.heading, color: colors.ink },
  section: { gap: 4 },
  sectionTitle: { ...type.secondary, fontWeight: '700', color: colors.ink },
  sectionBody: { ...type.secondary, color: colors.muted },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.field,
    borderRadius: 16,
    padding: 14,
  },
  noteText: { ...type.caption, color: colors.muted, flex: 1 },
});
