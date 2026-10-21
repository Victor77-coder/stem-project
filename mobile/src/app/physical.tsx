import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { NavPair } from '@/components/NavPair';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { useRegistration, type Sexo } from '@/context/RegistrationContext';
import { colors, type } from '@/theme';

const sexos: { id: Exclude<Sexo, 'outro' | ''>; label: string }[] = [
  { id: 'feminino', label: 'Feminino' },
  { id: 'masculino', label: 'Masculino' },
];

const COMORBIDITIES = ['Nenhuma', 'Hipertensão', 'Diabetes', 'Cardiopatia', 'Doença autoimune', 'Outra'];

export default function PhysicalScreen() {
  const { draft, update } = useRegistration();

  function toggleComorbidity(item: string) {
    if (item === 'Nenhuma') {
      update({ comorbidities: draft.comorbidities.includes('Nenhuma') ? [] : ['Nenhuma'] });
      return;
    }
    const withoutNone = draft.comorbidities.filter((c) => c !== 'Nenhuma');
    const next = withoutNone.includes(item) ? withoutNone.filter((c) => c !== item) : [...withoutNone, item];
    update({ comorbidities: next });
  }

  return (
    <Screen
      footer={
        <NavPair
          onLeft={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/terms');
          }}
          onRight={() => router.push('/location')}
        />
      }
    >
      <StepHeader
        title="Dados físicos"
        subtitle="Usamos apenas para personalizar conteúdos. Você pode alterar depois."
        step={4}
        total={5}
        brand={<Logo />}
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Field
            label="Peso"
            placeholder="kg"
            keyboardType="decimal-pad"
            value={draft.weight}
            onChangeText={(weight) => update({ weight })}
          />
        </View>
        <View style={styles.half}>
          <Field
            label="Altura"
            placeholder="m"
            keyboardType="decimal-pad"
            value={draft.height}
            onChangeText={(height) => update({ height })}
          />
        </View>
      </View>

      <Text style={styles.label}>Sexo biológico</Text>
      <View style={styles.row}>
        {sexos.map((item) => {
          const on = draft.sex === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => update({ sex: item.id })}
              style={[styles.sex, on && styles.sexOn]}
            >
              <Text style={[styles.sexText, on && styles.sexTextOn]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Comorbidades</Text>
      <View style={styles.chips}>
        {COMORBIDITIES.map((item) => {
          const on = draft.comorbidities.includes(item);
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => toggleComorbidity(item)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.info}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Esses dados não definem se você pode doar. Essa avaliação é feita apenas por médicos do SUS.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  label: { ...type.secondary, color: colors.ink, fontWeight: '600' },
  sex: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  sexOn: { borderColor: colors.primary, backgroundColor: colors.chip },
  sexText: { ...type.secondary, color: colors.muted, fontWeight: '600' },
  sexTextOn: { color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.secondary, color: colors.ink, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  info: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.chip,
    alignItems: 'flex-start',
  },
  infoText: { ...type.secondary, color: colors.primary, flex: 1 },
});
