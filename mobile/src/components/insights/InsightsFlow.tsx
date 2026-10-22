import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  INBOX,
  KIND_LABEL,
  UFS,
  YEARS,
  headline,
  regionBars,
  regionOf,
  waitFor,
  type Notice,
  type NoticeKind,
  type StatYear,
} from '@/content/insights';
import { colors } from '@/theme';

export type InsightScreen = 'stats' | 'inbox' | 'prefs';
type InboxFilter = 'todas' | NoticeKind;

type Prefs = {
  push: boolean;
  email: boolean;
  campaigns: boolean;
  events: boolean;
  official: boolean;
};

const DEFAULT_PREFS: Prefs = {
  push: true,
  email: true,
  campaigns: true,
  events: true,
  official: true,
};

let sessionInbox: Notice[] = INBOX;
let sessionPrefs: Prefs = DEFAULT_PREFS;

const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'campanha', label: 'Campanhas' },
  { id: 'evento', label: 'Eventos' },
  { id: 'comunicado', label: 'Comunicados' },
];

const ICONS: Record<NoticeKind, keyof typeof Ionicons.glyphMap> = {
  campanha: 'megaphone-outline',
  evento: 'calendar-outline',
  comunicado: 'document-text-outline',
};

type Props = {
  initial: InsightScreen;
  email?: string;
  onClose: () => void;
  onUnread?: (count: number) => void;
};

export function InsightsFlow({ initial, email = '', onClose, onUnread }: Props) {
  const [screen, setScreen] = useState<InsightScreen>(initial);
  const [notices, setNotices] = useState<Notice[]>(sessionInbox);
  const [prefs, setPrefs] = useState<Prefs>(sessionPrefs);
  const [filter, setFilter] = useState<InboxFilter>('todas');

  useEffect(() => {
    sessionInbox = notices;
    sessionPrefs = prefs;
    onUnread?.(notices.filter((item) => !item.read).length);
  }, [notices, prefs, onUnread]);

  if (screen === 'prefs') {
    return (
      <PreferencesScreen
        email={email}
        prefs={prefs}
        onChange={(patch) => setPrefs((current) => ({ ...current, ...patch }))}
        onBack={() => setScreen('inbox')}
      />
    );
  }

  if (screen === 'inbox') {
    return (
      <InboxScreen
        notices={notices}
        filter={filter}
        onFilter={setFilter}
        onOpen={(id) => setNotices((list) => list.map((item) => (item.id === id ? { ...item, read: true } : item)))}
        onClearRead={() => setNotices((list) => list.filter((item) => !item.read))}
        onPrefs={() => setScreen('prefs')}
        onBack={onClose}
      />
    );
  }

  return <StatsScreen onBack={onClose} />;
}

function TopBar({
  title,
  onBack,
  actionIcon,
  actionLabel,
  onAction,
}: {
  title: string;
  onBack: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} hitSlop={8} style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      {actionIcon && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name={actionIcon} size={22} color={colors.ink} />
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
}

function StatsScreen({ onBack }: { onBack: () => void }) {
  const [uf, setUf] = useState('AL');
  const [year, setYear] = useState<StatYear>('2025');
  const [picking, setPicking] = useState<null | 'uf' | 'year'>(null);
  const bars = regionBars(year);
  const max = Math.max(...bars.map((bar) => bar.value));
  const region = regionOf(uf);
  const cards = headline(year);
  const ufName = UFS.find(([code]) => code === uf)?.[1] ?? uf;

  return (
    <View style={styles.fill}>
      <TopBar title="Estatísticas" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Panorama no Brasil</Text>
        <Text style={styles.pageSubtitle}>Dados públicos agregados sobre transplantes de células-tronco.</Text>
        <View style={styles.filterRow}>
          <Pressable accessibilityRole="button" onPress={() => setPicking('uf')} style={styles.filterChip}>
            <Ionicons name="chevron-down" size={14} color={colors.primary600} />
            <Text style={styles.filterText}>Estado: {ufName}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setPicking('year')} style={styles.filterChip}>
            <Ionicons name="chevron-down" size={14} color={colors.primary600} />
            <Text style={styles.filterText}>Ano: {year}</Text>
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <View style={[styles.miniWell, { backgroundColor: colors.primary100 }]}>
              <Ionicons name="people-outline" size={16} color={colors.primary600} />
            </View>
            <Text style={styles.statValue}>{cards.donors}</Text>
            <Text style={styles.statCaption}>doadores no REDOME</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.miniWell, { backgroundColor: colors.teal100 }]}>
              <Ionicons name="pulse-outline" size={16} color={colors.teal600} />
            </View>
            <Text style={styles.statValue}>{cards.transplants}</Text>
            <Text style={styles.statCaption}>transplantes de medula em {year}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Transplantes de medula por região ({year})</Text>
          {bars.map((bar) => {
            const active = bar.name === region;
            return (
              <View key={bar.name} style={styles.barRow}>
                <Text style={[styles.barLabel, active && styles.barLabelOn]}>{bar.name}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(8, (bar.value / max) * 100)}%`, backgroundColor: active ? colors.teal600 : colors.primary600 },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>{bar.value.toLocaleString('pt-BR')}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.waitCard}>
          <Text style={styles.waitLabel}>Tempo médio de espera por doador não aparentado</Text>
          <Text style={styles.waitValue}>{waitFor(uf)}</Text>
          <Text style={styles.waitHint}>Recorte aproximado para {ufName}. Não é prazo de atendimento.</Text>
        </View>

        <View style={styles.warn}>
          <Ionicons name="warning-outline" size={16} color={colors.danger600} />
          <Text style={styles.warnText}>Dados públicos podem ter subnotificação e atraso de atualização.</Text>
        </View>
        <View style={styles.source}>
          <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.sourceText}>Fonte: DataSUS/Tabnet e REDOME · Atualizado em 08/2026</Text>
        </View>
      </ScrollView>

      <PickerModal
        visible={picking !== null}
        title={picking === 'year' ? 'Ano' : 'Estado'}
        options={
          picking === 'year'
            ? YEARS.map((item) => ({ id: item, label: item }))
            : UFS.map(([code, name]) => ({ id: code, label: name }))
        }
        selected={picking === 'year' ? year : uf}
        onSelect={(id) => {
          if (picking === 'year') setYear(id as StatYear);
          else setUf(id);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    </View>
  );
}

function InboxScreen({
  notices,
  filter,
  onFilter,
  onOpen,
  onClearRead,
  onPrefs,
  onBack,
}: {
  notices: Notice[];
  filter: InboxFilter;
  onFilter: (filter: InboxFilter) => void;
  onOpen: (id: string) => void;
  onClearRead: () => void;
  onPrefs: () => void;
  onBack: () => void;
}) {
  const visible = useMemo(
    () => notices.filter((item) => filter === 'todas' || item.kind === filter),
    [notices, filter],
  );
  const today = visible.filter((item) => item.group === 'hoje');
  const week = visible.filter((item) => item.group === 'semana');
  const hasRead = notices.some((item) => item.read);

  return (
    <View style={styles.fill}>
      <TopBar title="Notificações" onBack={onBack} actionIcon="options-outline" actionLabel="Preferências de aviso" onAction={onPrefs} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((item) => {
            const on = item.id === filter;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => onFilter(item.id)}
                style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {visible.length === 0 ? <Text style={styles.empty}>Nenhum aviso neste filtro.</Text> : null}
        <NoticeGroup title="Hoje" items={today} onOpen={onOpen} />
        <NoticeGroup title="Esta semana" items={week} onOpen={onOpen} />

        {hasRead ? (
          <Pressable accessibilityRole="button" onPress={onClearRead} style={styles.clearBtn}>
            <Text style={styles.clearText}>Limpar notificações lidas</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function NoticeGroup({ title, items, onOpen }: { title: string; items: Notice[]; onOpen: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title.toUpperCase()}</Text>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => onOpen(item.id)}
          style={[styles.notice, !item.read && styles.noticeUnread]}
        >
          <View style={[styles.miniWell, { backgroundColor: item.kind === 'evento' ? colors.primary100 : colors.teal100 }]}>
            <Ionicons
              name={ICONS[item.kind]}
              size={16}
              color={item.kind === 'evento' ? colors.primary600 : colors.teal600}
            />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>{item.title}</Text>
            <Text style={styles.noticeBody}>{item.body}</Text>
            <Text style={styles.noticeMeta}>
              {KIND_LABEL[item.kind]} · Origem: {item.origin} · {item.when}
            </Text>
          </View>
          {!item.read ? <View style={styles.dot} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

function PreferencesScreen({
  email,
  prefs,
  onChange,
  onBack,
}: {
  email: string;
  prefs: Prefs;
  onChange: (patch: Partial<Prefs>) => void;
  onBack: () => void;
}) {
  const masked = email ? maskEmail(email) : 'm***@gmail.com';
  return (
    <View style={styles.fill}>
      <TopBar title="Preferências de aviso" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Como quer ser avisado?</Text>
        <Text style={styles.pageSubtitle}>Você só recebe avisos que autorizar (opt-in). Pode mudar a qualquer momento.</Text>

        <View style={styles.panel}>
          <Text style={styles.kicker}>Canais</Text>
          <PrefRow icon="phone-portrait-outline" title="Notificações no celular" value={prefs.push} onChange={(push) => onChange({ push })} />
          <PrefRow icon="mail-outline" title="E-mail" caption={masked} value={prefs.email} onChange={(emailOn) => onChange({ email: emailOn })} />
          <PrefRow icon="logo-whatsapp" title="WhatsApp" caption="Requer número cadastrado" value={false} disabled />
        </View>

        <View style={styles.panel}>
          <Text style={styles.kicker}>Tipos de aviso</Text>
          <PrefRow
            icon="megaphone-outline"
            title="Campanhas de doação"
            caption="Perto de você"
            value={prefs.campaigns}
            onChange={(campaigns) => onChange({ campaigns })}
          />
          <PrefRow
            icon="calendar-outline"
            title="Eventos de saúde"
            value={prefs.events}
            onChange={(events) => onChange({ events })}
          />
          <PrefRow
            icon="document-text-outline"
            title="Comunicados oficiais"
            caption="Ministério da Saúde, INCA, Hemocentros"
            value={prefs.official}
            onChange={(official) => onChange({ official })}
          />
          <PrefRow
            icon="heart-outline"
            title="Doador localizado"
            caption="Disponível apenas com integração oficial do SUS (Fase 2)"
            value={false}
            disabled
          />
        </View>

        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary600} />
          <Text style={styles.infoText}>Todos os avisos vêm de fontes oficiais. O STEM nunca simula avisos de compatibilidade.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function PrefRow({
  icon,
  title,
  caption,
  value,
  disabled,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption?: string;
  value: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <View style={styles.prefRow}>
      <Ionicons name={icon} size={18} color={disabled ? colors.textTertiary : colors.textSecondary} />
      <View style={styles.noticeCopy}>
        <Text style={[styles.noticeTitle, disabled && styles.disabledText]}>{title}</Text>
        {caption ? <Text style={styles.noticeMeta}>{caption}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.borderSubtle, true: colors.primary600 }}
      />
    </View>
  );
}

function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={styles.backdropHit} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={styles.sheetList}>
            {options.map((option) => {
              const on = option.id === selected;
              return (
                <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onSelect(option.id)} style={styles.sheetRow}>
                  <Text style={[styles.sheetLabel, on && styles.sheetLabelOn]}>{option.label}</Text>
                  {on ? <Ionicons name="checkmark" size={18} color={colors.primary600} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function maskEmail(value: string) {
  const [name, domain] = value.split('@');
  if (!name || !domain) return value;
  return `${name.slice(0, 1)}***@${domain}`;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 48 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.ink },
  pageTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  pageSubtitle: { marginTop: 4, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary100,
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 32,
  },
  filterText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.primary600 },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: { flex: 1, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: 14, gap: 8 },
  miniWell: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  statCaption: { fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  panel: { marginTop: 16, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: 14, gap: 12 },
  panelTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.ink },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 92, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  barLabelOn: { color: colors.ink, fontWeight: '600' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { width: 42, textAlign: 'right', fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.ink },
  waitCard: { marginTop: 16, backgroundColor: colors.surfaceMuted, borderRadius: 16, padding: 14, gap: 4 },
  waitLabel: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  waitValue: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  waitHint: { fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  warn: { marginTop: 16, flexDirection: 'row', gap: 8, backgroundColor: colors.danger100, borderRadius: 12, padding: 12 },
  warnText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.danger600 },
  source: { marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 12 },
  sourceText: { flex: 1, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { height: 36, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary600 },
  chipOff: { backgroundColor: colors.surfaceMuted },
  chipText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: '#FFFFFF' },
  empty: { marginTop: 24, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  group: { marginTop: 20, gap: 10 },
  groupTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4, color: colors.textTertiary },
  notice: { flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: 12, backgroundColor: colors.bg },
  noticeUnread: { backgroundColor: colors.primary100 },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.ink },
  noticeBody: { marginTop: 2, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  noticeMeta: { marginTop: 4, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary600, marginTop: 6 },
  clearBtn: { marginTop: 20, alignItems: 'center' },
  clearText: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: colors.primary600 },
  kicker: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4, color: colors.textTertiary },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  disabledText: { color: colors.textTertiary },
  info: { marginTop: 16, flexDirection: 'row', gap: 8, backgroundColor: colors.primary50, borderRadius: 12, padding: 12 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.primary900 },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,36,51,0.4)', justifyContent: 'flex-end' },
  backdropHit: { ...StyleSheet.absoluteFillObject },
  sheet: { maxHeight: '70%', backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  sheetTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  sheetList: { flexGrow: 0 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  sheetLabel: { fontSize: 16, lineHeight: 24, color: colors.ink },
  sheetLabelOn: { color: colors.primary600, fontWeight: '600' },
});
