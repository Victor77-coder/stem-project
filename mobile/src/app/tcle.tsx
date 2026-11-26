import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useRegistration } from '@/context/RegistrationContext';
import { useConsentDoc } from '@/lib/consent';
import { colors, type } from '@/theme';

export default function TcleDocumentScreen() {
  const { update, isConvidado, signedIn, acceptTerms } = useRegistration();
  // Aberto pelo Perfil (?reaceite=1): quem já tem conta aceita a versão nova direto no servidor.
  const { reaceite } = useLocalSearchParams<{ reaceite?: string }>();
  const fromProfile = signedIn && reaceite === '1';
  // O convidado lê os termos de uso; doador e receptor, o TCLE.
  const doc = useConsentDoc(isConvidado ? 'termos' : 'tcle');

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
            if (!fromProfile) {
              update({ tcleAccepted: true, tcleVersion: doc.version });
              goBack();
              return;
            }
            acceptTerms(doc.version)
              .then(goBack)
              .catch((err: unknown) =>
                Alert.alert('Não foi possível registrar o aceite', err instanceof Error ? err.message : 'Tente novamente.'),
              );
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
        <Text style={styles.navTitle}>{isConvidado ? 'Termos de uso' : 'Termo de consentimento'}</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.chip}>
        <Text style={styles.chipText}>
          Versão {doc.version}
          {doc.publishedAt ? ` · ${doc.publishedAt}` : ''}
        </Text>
      </View>

      <Text style={styles.title}>{doc.title}</Text>

      {doc.sections.map((section) => (
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
