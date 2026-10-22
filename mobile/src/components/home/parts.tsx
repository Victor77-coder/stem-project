import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

type Ion = keyof typeof Ionicons.glyphMap;

export function HomeHeader({
  greeting,
  chip,
  chipBg,
  chipFg,
  subtitle,
}: {
  greeting: string;
  chip: string;
  chipBg: string;
  chipFg: string;
  subtitle: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <View style={styles.nameRow}>
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={[styles.roleChip, { backgroundColor: chipBg }]}>
            <Text style={[styles.roleText, { color: chipFg }]}>{chip}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Notificações" style={styles.bell}>
        <Ionicons name="notifications-outline" size={22} color={colors.ink} />
        <View style={styles.badge} />
      </Pressable>
    </View>
  );
}

export function JourneyCard({
  background,
  accent,
  eyebrow,
  title,
  body,
  progress,
  action,
  onAction,
}: {
  background: string;
  accent: string;
  eyebrow: string;
  title: string;
  body: string;
  progress?: `${number}%`;
  action: string;
  onAction?: () => void;
}) {
  return (
    <View style={[styles.journey, { backgroundColor: background }]}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.journeyTitle}>{title}</Text>
      <Text style={styles.journeyBody}>{body}</Text>
      {progress ? (
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: progress }]} />
        </View>
      ) : null}
      <Pressable accessibilityRole="button" onPress={onAction} style={styles.journeyButton}>
        <Text style={[styles.journeyButtonText, { color: accent }]}>{action}</Text>
        <Ionicons name="chevron-forward" size={16} color={accent} />
      </Pressable>
    </View>
  );
}

export function SectionTitle({ children, link, onLink }: { children: string; link?: string; onLink?: () => void }) {
  if (!link) return <Text style={[styles.sectionTitle, styles.blockTitle]}>{children}</Text>;
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{children}</Text>
      <Pressable accessibilityRole="button" onPress={onLink}>
        <Text style={styles.link}>{link}</Text>
      </Pressable>
    </View>
  );
}

export function QuickGrid({
  items,
}: {
  items: { title: string; icon: Ion; iconColor: string; well: string; onPress?: () => void }[];
}) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable key={item.title} accessibilityRole="button" onPress={item.onPress} style={styles.quickCard}>
          <View style={[styles.well, { backgroundColor: item.well }]}>
            <Ionicons name={item.icon} size={20} color={item.iconColor} />
          </View>
          <Text style={styles.quickTitle}>{item.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CampaignCard({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.well, { backgroundColor: colors.teal100 }]}>
          <Ionicons name="megaphone-outline" size={20} color={colors.teal600} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.cardTitle}>Mutirão de cadastro de doadores de medula</Text>
          <Text style={styles.cardMeta}>Hemoal · Maceió/AL · a 3,2 km</Text>
        </View>
      </View>
      <View style={styles.chips}>
        <View style={[styles.chip, { backgroundColor: colors.teal100 }]}>
          <Text style={[styles.chipText, { color: colors.teal600 }]}>25 out · 8h–16h</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.chipText, { color: colors.textSecondary }]}>Campanha</Text>
        </View>
      </View>
      <Text style={styles.source}>Fonte: Ministério da Saúde · Publicado em 12/10/2026</Text>
    </Pressable>
  );
}

export function ArticleList({
  items,
}: {
  items: { title: string; meta: string; icon: Ion; iconColor: string; well: string; onPress?: () => void }[];
}) {
  return (
    <>
      {items.map((article) => (
        <Pressable key={article.title} accessibilityRole="button" onPress={article.onPress} style={styles.article}>
          <View style={[styles.well, { backgroundColor: article.well }]}>
            <Ionicons name={article.icon} size={20} color={article.iconColor} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.cardTitle}>{article.title}</Text>
            <Text style={styles.cardMeta}>{article.meta}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
      ))}
    </>
  );
}

export function EstimateCard() {
  return (
    <View style={styles.estimate}>
      <View style={styles.estimateHead}>
        <Ionicons name="sparkles" size={16} color={colors.warning700} />
        <Text style={styles.estimateTitle}>Estimativa para a sua região</Text>
      </View>
      <View style={styles.estimateStat}>
        <Text style={styles.estimateValue}>~120 dias</Text>
        <Text style={styles.estimateCaption}>tempo médio até o transplante em Maceió/AL</Text>
      </View>
      <Text style={styles.estimateNote}>
        Aproximação estatística baseada em dados públicos e localização. Não é garantia de atendimento, procedimento ou prazo.
      </Text>
    </View>
  );
}

export function ProfileInvite({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.invite}>
      <View style={styles.row}>
        <View style={[styles.well, styles.inviteWell]}>
          <Ionicons name="person-add-outline" size={20} color={colors.primary600} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.cardTitle}>Quer ser doador ou precisa de tratamento?</Text>
          <Text style={styles.cardMeta}>Crie seu perfil para acompanhar uma jornada personalizada.</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.inviteButton}>
        <Text style={styles.inviteButtonText}>Escolher um perfil</Text>
      </Pressable>
    </View>
  );
}

export function Soon({ title }: { title: string }) {
  return (
    <View style={styles.soon}>
      <Text style={styles.soonTitle}>{title}</Text>
      <Text style={styles.soonBody}>Esta área entra junto com as próximas telas do protótipo.</Text>
    </View>
  );
}

export const shell = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#EEF1F6' },
  phone: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.bg,
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  greeting: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  roleChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  roleText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  subtitle: { marginTop: 4, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger600,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  journey: { marginTop: 20, borderRadius: 20, padding: 16 },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  journeyTitle: { marginTop: 6, fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#FFFFFF' },
  journeyBody: { marginTop: 6, fontSize: 14, lineHeight: 21, color: '#FFFFFF' },
  track: {
    marginTop: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: 2, backgroundColor: '#FFFFFF' },
  journeyButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 10,
    height: 36,
  },
  journeyButtonText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  sectionTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.ink },
  blockTitle: { marginTop: 24 },
  sectionHead: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  link: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: colors.primary600 },
  grid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: {
    width: '47.5%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 14,
    minHeight: 112,
  },
  well: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: { marginTop: 10, fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.ink },
  card: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 14,
  },
  row: { flexDirection: 'row', gap: 12 },
  copy: { flex: 1 },
  cardTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.ink },
  cardMeta: { marginTop: 2, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  source: { marginTop: 10, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  article: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  estimate: {
    marginTop: 12,
    backgroundColor: colors.warning100,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  estimateHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estimateTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.warning700 },
  estimateStat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  estimateValue: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.warning700 },
  estimateCaption: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.warning700 },
  estimateNote: { fontSize: 14, lineHeight: 21, color: colors.warning700 },
  invite: {
    marginTop: 16,
    backgroundColor: colors.primary100,
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },
  inviteWell: { backgroundColor: '#FFFFFF' },
  inviteButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonText: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#FFFFFF' },
  soon: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  soonTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.ink },
  soonBody: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, textAlign: 'center' },
});
