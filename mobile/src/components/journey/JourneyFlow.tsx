import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  REGIONS,
  doneCount,
  progressPercent,
  stepStates,
  stepsFor,
  type JourneyKind,
  type JourneyMarks,
  type JourneyStep,
  type RegionId,
  type StepState,
} from '@/content/journey';
import { colors } from '@/theme';

type Props = {
  kind: JourneyKind | 'convidado';
  /** Guia pessoal (RF05/RF06): etapas e itens que o próprio usuário marcou. */
  marks: JourneyMarks;
  region: RegionId;
  onRegion: (region: RegionId) => void;
  onToggleStep: (stepId: string) => void;
  onToggleItem: (stepId: string, label: string) => void;
  onChooseProfile: (profile: 'doador' | 'receptor') => void;
};

export function JourneyFlow({ kind, marks, region, onRegion, onToggleStep, onToggleItem, onChooseProfile }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (kind === 'convidado') {
    return <ConvidadoJourney onChooseProfile={onChooseProfile} />;
  }

  const steps = stepsFor(kind, region);
  const states = stepStates(steps, marks.done);
  const count = doneCount(steps, marks.done);
  const openIndex = steps.findIndex((step) => step.id === openId);

  if (openIndex >= 0) {
    const open = steps[openIndex];
    return (
      <StepDetail
        step={open}
        index={openIndex + 1}
        total={steps.length}
        state={states[openIndex]}
        checked={marks.checklist[open.id] ?? []}
        onBack={() => setOpenId(null)}
        onToggleItem={(label) => onToggleItem(open.id, label)}
        onToggle={() => {
          onToggleStep(open.id);
          setOpenId(null);
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Minha jornada</Text>
      <Text style={styles.pageSubtitle}>
        {kind === 'doador'
          ? 'Etapas oficiais do Ministério da Saúde para doar medula óssea.'
          : 'Fluxo do tratamento com células-tronco no SUS.'}
      </Text>

      {kind === 'receptor' ? (
        <View style={styles.regionRow}>
          {REGIONS.map((item) => {
            const on = item.id === region;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onRegion(item.id)}
                style={[styles.regionChip, on ? styles.regionOn : styles.regionOff]}
              >
                <Text style={[styles.regionText, on ? styles.regionTextOn : styles.regionTextOff]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.warning}>
        <Ionicons name="warning-outline" size={18} color={colors.danger600} />
        <Text style={styles.warningText}>
          {kind === 'doador'
            ? 'O STEM Project não efetiva a doação. Ele só aponta um guia — a doação acontece no hemocentro e no SUS.'
            : 'O app não marca consultas nem transplantes. Siga sempre as orientações da sua equipe médica.'}
        </Text>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHead}>
          <Text style={styles.progressLabel}>Etapas que você marcou</Text>
          <Text style={styles.progressValue}>
            {count} de {steps.length}
          </Text>
        </View>
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityValue={{ now: count, min: 0, max: steps.length }}
        >
          <View style={[styles.progressFill, { width: progressPercent(count, steps.length) }]} />
        </View>
      </View>

      <View style={styles.timeline}>
        {steps.map((step, i) => (
          <StepRow
            key={step.id}
            index={i + 1}
            step={step}
            state={states[i]}
            last={i === steps.length - 1}
            onPress={() => setOpenId(step.id)}
            onToggle={() => onToggleStep(step.id)}
          />
        ))}
      </View>

      <Text style={styles.hint}>
        Você marca as etapas que já fez, em qualquer ordem. Serve só para o seu controle: o app não recebe informações do
        SUS nem do REDOME.
      </Text>
    </ScrollView>
  );
}

function StepRow({
  index,
  step,
  state,
  last,
  onPress,
  onToggle,
}: {
  index: number;
  step: JourneyStep;
  state: StepState;
  last: boolean;
  onPress: () => void;
  onToggle: () => void;
}) {
  const next = state === 'next';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${step.title}, ${statusLabel(state)}`}
      accessibilityHint="Abre a etapa"
      onPress={onPress}
      style={[styles.step, next && styles.stepCurrent]}
    >
      <View style={styles.rail}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: state === 'done' }}
          accessibilityLabel={`Marcar ${step.title} como concluída`}
          onPress={onToggle}
          hitSlop={8}
        >
          <StatusMark index={index} state={state} />
        </Pressable>
        {last ? null : <View style={[styles.railLine, next && styles.railLineCurrent]} />}
      </View>
      <View style={styles.stepCopy}>
        <View style={styles.stepHead}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={[styles.stepStatus, statusColor(state)]}>{statusLabel(state)}</Text>
        </View>
        <Text style={styles.stepSummary}>{step.summary}</Text>
      </View>
    </Pressable>
  );
}

function StatusMark({ index, state }: { index: number; state: StepState }) {
  if (state === 'done') {
    return (
      <View style={[styles.mark, styles.markDone]}>
        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
      </View>
    );
  }
  if (state === 'next') {
    return (
      <View style={[styles.mark, styles.markCurrent]}>
        <Text style={styles.markCurrentText}>{index}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.mark, styles.markPending]}>
      <Text style={styles.markPendingText}>{index}</Text>
    </View>
  );
}

function StepDetail({
  step,
  index,
  total,
  state,
  checked,
  onBack,
  onToggleItem,
  onToggle,
}: {
  step: JourneyStep;
  index: number;
  total: number;
  state: StepState;
  checked: string[];
  onBack: () => void;
  onToggleItem: (label: string) => void;
  onToggle: () => void;
}) {
  const done = state === 'done';
  return (
    <View style={styles.fill}>
      <ScrollView style={styles.fill} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.topTitle}>
            Etapa {index} de {total}
          </Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={[styles.badge, done && styles.badgeDone]}>
          <Text style={[styles.badgeText, done && styles.badgeTextDone]}>{statusLabel(state)}</Text>
        </View>
        <Text style={styles.detailTitle}>{step.title}</Text>
        <Text style={styles.detailBody}>{step.body}</Text>

        {step.checklist ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Checklist da etapa</Text>
            {step.checklist.map((item) => {
              const on = checked.includes(item.label);
              return (
                <Pressable
                  key={item.label}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => onToggleItem(item.label)}
                  style={styles.checkRow}
                >
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
                  </View>
                  <Text style={styles.checkLabel}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step.place ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Onde fazer</Text>
            <View style={styles.place}>
              <View style={[styles.well, { backgroundColor: colors.primary100 }]}>
                <Ionicons name="business-outline" size={20} color={colors.primary600} />
              </View>
              <View style={styles.placeCopy}>
                <Text style={styles.placeName}>{step.place.name}</Text>
                <Text style={styles.placeMeta}>{step.place.address}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <Text style={styles.source}>Fonte: {step.source}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={onToggle} style={done ? styles.secondary : styles.primary}>
          <Text style={done ? styles.secondaryText : styles.primaryText}>
            {done ? 'Desmarcar etapa' : 'Marcar como concluída'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ConvidadoJourney({ onChooseProfile }: { onChooseProfile: (profile: 'doador' | 'receptor') => void }) {
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.convidadoContent} showsVerticalScrollIndicator={false}>
      <View style={styles.convidadoBadge}>
        <Ionicons name="git-branch-outline" size={32} color={colors.primary600} />
      </View>
      <Text style={styles.convidadoTitle}>Acompanhe uma jornada</Text>
      <Text style={styles.convidadoSubtitle}>
        Escolha um perfil para ver as etapas oficiais de doação ou de tratamento, passo a passo.
      </Text>

      <Choice
        icon="heart-outline"
        well={colors.primary100}
        iconColor={colors.primary600}
        title="Quero ser Doador"
        body="Etapas para doar medula óssea"
        onPress={() => onChooseProfile('doador')}
      />
      <Choice
        icon="medkit-outline"
        well={colors.teal100}
        iconColor={colors.teal600}
        title="Preciso de tratamento"
        body="Etapas para receber um transplante"
        onPress={() => onChooseProfile('receptor')}
      />

      <Text style={styles.convidadoNote}>Para isso, pediremos alguns dados e o consentimento informado (TCLE).</Text>
    </ScrollView>
  );
}

function Choice({
  icon,
  well,
  iconColor,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  well: string;
  iconColor: string;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="radio" onPress={onPress} style={styles.choice}>
      <View style={[styles.well, { backgroundColor: well }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceBody}>{body}</Text>
      </View>
      <View style={styles.radio} />
    </Pressable>
  );
}

function statusLabel(state: StepState) {
  if (state === 'done') return 'Concluída';
  if (state === 'next') return 'Próxima';
  return 'Pendente';
}

function statusColor(state: StepState) {
  if (state === 'done') return { color: colors.success600 };
  if (state === 'next') return { color: colors.primary600 };
  return { color: colors.textTertiary };
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  detailContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  pageTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.ink },
  pageSubtitle: { marginTop: 4, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  regionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  regionChip: { height: 32, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  // O filtro de região só aparece na jornada do receptor: usa o verde do cartão "Sua jornada de tratamento".
  regionOn: { backgroundColor: colors.success },
  regionOff: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderSubtle },
  regionText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  regionTextOn: { color: '#FFFFFF' },
  regionTextOff: { color: colors.textSecondary },
  warning: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: colors.danger100,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.danger600 },
  progressCard: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: colors.primary50,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.primary600 },
  progressValue: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.primary600 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary600 },
  timeline: { marginTop: 12 },
  step: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  stepCurrent: { backgroundColor: colors.primary50 },
  rail: { width: 28, alignItems: 'center' },
  railLine: {
    width: 2,
    flex: 1,
    minHeight: 18,
    marginTop: 4,
    backgroundColor: colors.borderSubtle,
  },
  railLineCurrent: { backgroundColor: colors.primary100 },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDone: { backgroundColor: colors.success600 },
  markCurrent: { backgroundColor: colors.primary600 },
  markPending: { backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.borderSubtle },
  markCurrentText: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: '#FFFFFF' },
  markPendingText: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: colors.textTertiary },
  stepCopy: { flex: 1, paddingBottom: 8 },
  stepHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stepTitle: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.ink },
  stepStatus: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  stepSummary: { marginTop: 4, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  hint: { marginTop: 8, fontSize: 13, lineHeight: 18, color: colors.textTertiary },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: colors.primary100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeDone: { backgroundColor: colors.success100 },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.primary600 },
  badgeTextDone: { color: colors.success600 },
  detailTitle: { marginTop: 10, fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  detailBody: { marginTop: 8, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  block: { marginTop: 22 },
  blockTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary600, borderColor: colors.primary600 },
  checkLabel: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.ink },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 12,
  },
  well: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  placeCopy: { flex: 1 },
  placeName: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  placeMeta: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  source: { marginTop: 18, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  primary: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#FFFFFF' },
  secondary: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  convidadoContent: { paddingHorizontal: 20, paddingTop: 36, paddingBottom: 28, alignItems: 'center' },
  convidadoBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convidadoTitle: { marginTop: 20, fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  convidadoSubtitle: { marginTop: 8, fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' },
  choice: {
    alignSelf: 'stretch',
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  choiceCopy: { flex: 1 },
  choiceTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  choiceBody: { marginTop: 2, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
  },
  convidadoNote: {
    marginTop: 20,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
