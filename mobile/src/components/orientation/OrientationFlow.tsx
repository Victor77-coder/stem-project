import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LearnRoute } from '@/components/learn/LearnFlow';
import { colors } from '@/theme';

type Step = 'intro' | 'age' | 'conditions' | 'result';
type AgeId = 'under-18' | '18-35' | '36-60' | 'over-60';
type ConditionId = 'nenhuma' | 'hipertensao' | 'diabetes' | 'sangue' | 'nao-informar';

const AGES: { id: AgeId; label: string }[] = [
  { id: 'under-18', label: 'Menos de 18 anos' },
  { id: '18-35', label: '18 a 35 anos' },
  { id: '36-60', label: '36 a 60 anos' },
  { id: 'over-60', label: 'Mais de 60 anos' },
];

const CONDITIONS: { id: ConditionId; label: string }[] = [
  { id: 'nenhuma', label: 'Nenhuma' },
  { id: 'hipertensao', label: 'Hipertensão' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'sangue', label: 'Doença do sangue (ex.: leucemia)' },
  { id: 'nao-informar', label: 'Prefiro não informar' },
];

const EXCLUSIVE = new Set<ConditionId>(['nenhuma', 'nao-informar']);

const NOTES = [
  { icon: 'time-outline' as const, label: 'Leva menos de 1 minuto' },
  { icon: 'refresh-outline' as const, label: 'Você pode refazer quando quiser' },
  { icon: 'shield-checkmark-outline' as const, label: 'Suas respostas anteriores são substituídas' },
];

type Reading = {
  title: string;
  meta: string;
  icon: keyof typeof Ionicons.glyphMap;
  well: string;
  iconColor: string;
  route: LearnRoute;
};

function readings(conditions: ConditionId[]): Reading[] {
  const who: Reading = {
    title: 'Quem pode ser doador de medula',
    meta: 'Conceito · 3 min',
    icon: 'git-network-outline',
    well: colors.primary100,
    iconColor: colors.primary600,
    route: { name: 'article', id: 'quem-pode' },
  };
  const register: Reading = {
    title: 'Como se cadastrar no REDOME',
    meta: 'Leis no Brasil · 4 min',
    icon: 'scale-outline',
    well: colors.surfaceMuted,
    iconColor: colors.textSecondary,
    route: { name: 'article', id: 'redome' },
  };
  const pressure: Reading = {
    title: 'Hipertensão impede a doação?',
    meta: 'FAQ · 2 min',
    icon: 'help-circle-outline',
    well: colors.warning100,
    iconColor: colors.warning700,
    route: { name: 'faq', focus: 'hipertensao' },
  };
  const blood: Reading = {
    title: 'Leucemia e o transplante de células-tronco',
    meta: 'Doenças · 6 min',
    icon: 'pulse-outline',
    well: colors.teal100,
    iconColor: colors.teal600,
    route: { name: 'article', id: 'leucemia' },
  };
  const myths: Reading = {
    title: 'Mitos e verdades sobre doar células-tronco',
    meta: 'Mitos · 3 min',
    icon: 'bulb-outline',
    well: colors.warning100,
    iconColor: colors.warning700,
    route: { name: 'myths' },
  };

  const middle = conditions.includes('hipertensao')
    ? pressure
    : conditions.includes('sangue')
      ? blood
      : myths;

  return [who, middle, register];
}

type Props = {
  onClose: () => void;
  onLearn: (route: LearnRoute) => void;
};

export function OrientationFlow({ onClose, onLearn }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [age, setAge] = useState<AgeId | null>(null);
  const [conditions, setConditions] = useState<ConditionId[]>([]);

  function reset() {
    setAge(null);
    setConditions([]);
    setStep('intro');
  }

  function toggleCondition(id: ConditionId) {
    setConditions((current) => {
      if (EXCLUSIVE.has(id)) return current.includes(id) ? [] : [id];
      const rest = current.filter((item) => !EXCLUSIVE.has(item));
      return rest.includes(id) ? rest.filter((item) => item !== id) : [...rest, id];
    });
  }

  const canContinue = step === 'age' ? age !== null : conditions.length > 0;
  const suggestions = readings(conditions);

  return (
    <View style={styles.fill}>
      <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => {
              if (step === 'intro') onClose();
              else if (step === 'age') setStep('intro');
              else if (step === 'conditions') setStep('age');
              else setStep('conditions');
            }}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.topTitle}>
            {step === 'intro' ? 'Questionário' : step === 'result' ? 'Sugestões para você' : step === 'age' ? 'Pergunta 1 de 4' : 'Pergunta 3 de 4'}
          </Text>
          <View style={styles.iconBtn} />
        </View>

        {step === 'age' || step === 'conditions' ? (
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: step === 'age' ? '25%' : '75%' }]} />
          </View>
        ) : null}

        {step === 'intro' ? (
          <View style={styles.intro}>
            <View style={styles.badge}>
              <Ionicons name="clipboard-outline" size={28} color={colors.warning700} />
            </View>
            <Text style={styles.title}>Questionário de orientação</Text>
            <Text style={styles.subtitle}>4 perguntas rápidas para sugerir conteúdos que combinam com você.</Text>
            <View style={styles.noteCard}>
              {NOTES.map((note) => (
                <View key={note.label} style={styles.noteRow}>
                  <Ionicons name={note.icon} size={18} color={colors.textSecondary} />
                  <Text style={styles.noteText}>{note.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.warning}>
              <Ionicons name="warning-outline" size={18} color={colors.danger600} />
              <Text style={styles.warningText}>
                Este questionário NÃO avalia se você pode doar ou receber. Ele apenas sugere leituras.
              </Text>
            </View>
          </View>
        ) : null}

        {step === 'age' ? (
          <View>
            <Text style={styles.question}>Qual é a sua faixa de idade?</Text>
            <Text style={styles.helper}>Usamos para indicar conteúdos sobre quem pode doar.</Text>
            {AGES.map((option) => (
              <Choice
                key={option.id}
                label={option.label}
                selected={age === option.id}
                kind="radio"
                onPress={() => setAge(option.id)}
              />
            ))}
          </View>
        ) : null}

        {step === 'conditions' ? (
          <View>
            <Text style={styles.question}>Você tem alguma dessas condições?</Text>
            <Text style={styles.helper}>Pode marcar mais de uma opção.</Text>
            {CONDITIONS.map((option) => (
              <Choice
                key={option.id}
                label={option.label}
                selected={conditions.includes(option.id)}
                kind="check"
                onPress={() => toggleCondition(option.id)}
              />
            ))}
          </View>
        ) : null}

        {step === 'result' ? (
          <View>
            <View style={styles.ready}>
              <Text style={styles.readyLabel}>Pronto</Text>
              <Text style={styles.readyTitle}>Separamos 3 leituras com base nas suas respostas</Text>
            </View>
            <View style={styles.warning}>
              <Ionicons name="warning-outline" size={18} color={colors.danger600} />
              <Text style={styles.warningText}>
                Este resultado não decide aptidão clínica. Apenas médicos do SUS avaliam quem pode doar ou receber.
              </Text>
            </View>
            {suggestions.map((item) => (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                onPress={() => onLearn(item.route)}
                style={styles.reading}
              >
                <View style={[styles.well, { backgroundColor: item.well }]}>
                  <Ionicons name={item.icon} size={22} color={item.iconColor} />
                </View>
                <View style={styles.readingCopy}>
                  <Text style={styles.readingTitle}>{item.title}</Text>
                  <Text style={styles.readingMeta}>{item.meta}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step === 'intro' ? (
          <Pressable accessibilityRole="button" onPress={() => setStep('age')} style={styles.primary}>
            <Text style={styles.primaryText}>Começar</Text>
          </Pressable>
        ) : null}
        {step === 'age' || step === 'conditions' ? (
          <View style={styles.footerRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep(step === 'age' ? 'intro' : 'age')}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Voltar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!canContinue}
              onPress={() => setStep(step === 'age' ? 'conditions' : 'result')}
              style={[styles.primary, styles.primaryHalf, !canContinue && styles.disabled]}
            >
              <Text style={styles.primaryText}>Próxima</Text>
            </Pressable>
          </View>
        ) : null}
        {step === 'result' ? (
          <View style={styles.footerRow}>
            <Pressable accessibilityRole="button" onPress={reset} style={styles.secondary}>
              <Text style={styles.secondaryText}>Refazer</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onLearn({ name: 'library' })}
              style={[styles.primary, styles.primaryHalf]}
            >
              <Text style={styles.primaryText}>Ir para Aprender</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Choice({
  label,
  selected,
  kind,
  onPress,
}: {
  label: string;
  selected: boolean;
  kind: 'radio' | 'check';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={kind === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <Text style={styles.choiceText}>{label}</Text>
      {kind === 'radio' ? (
        <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      ) : (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 999, backgroundColor: colors.surfaceMuted, marginBottom: 20 },
  trackFill: { height: 4, borderRadius: 999, backgroundColor: colors.primary600 },
  intro: { alignItems: 'center', paddingTop: 12 },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.warning100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: 20, fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' },
  noteCard: {
    alignSelf: 'stretch',
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },
  warning: {
    alignSelf: 'stretch',
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: colors.danger100,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.danger600 },
  question: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  helper: { marginTop: 6, marginBottom: 8, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  choice: {
    marginTop: 10,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  choiceOn: { backgroundColor: colors.primary50, borderColor: colors.primary600 },
  choiceText: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary600 },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary600 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary600, borderColor: colors.primary600 },
  ready: { borderRadius: 16, backgroundColor: colors.primary600, padding: 16 },
  readyLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  readyTitle: { marginTop: 6, fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#FFFFFF' },
  reading: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  well: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  readingCopy: { flex: 1 },
  readingTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  readingMeta: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  footerRow: { flexDirection: 'row', gap: 10 },
  primary: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryHalf: { flex: 1.15 },
  primaryText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#FFFFFF' },
  secondary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  disabled: { opacity: 0.45 },
});
