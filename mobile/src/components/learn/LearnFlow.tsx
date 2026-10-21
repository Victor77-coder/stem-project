import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ARTICLES,
  CATEGORIES,
  FAQS,
  MYTHS,
  articleById,
  cardMeta,
  catalogArticles,
  fold,
  searchArticles,
  type Article,
  type LibraryFilter,
} from '@/content/learn';
import { colors } from '@/theme';

export type LearnRoute =
  | { name: 'library'; category?: LibraryFilter }
  | { name: 'search'; query: string }
  | { name: 'article'; id: string }
  | { name: 'faq' }
  | { name: 'myths' }
  | { name: 'quiz' };

type Props = {
  route: LearnRoute;
  onChange: (route: LearnRoute) => void;
  onBack: () => void;
};

export function LearnFlow({ route, onChange, onBack }: Props) {
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const quizState = useRef({ step: 0, picks: [] as string[] });

  const openArticle = (id: string) => onChange({ name: 'article', id });
  const openQuiz = () => {
    quizState.current = { step: 0, picks: [] };
    onChange({ name: 'quiz' });
  };

  return (
    <View style={styles.fill}>
      {route.name === 'library' ? (
        <Library initialCategory={route.category ?? 'Todos'} onChange={onChange} onArticle={openArticle} onQuiz={openQuiz} />
      ) : null}
      {route.name === 'search' ? <SearchScreen initialQuery={route.query} onArticle={openArticle} /> : null}
      {route.name === 'article' ? (
        <ArticleScreen
          article={articleById(route.id)}
          saved={Boolean(saved[route.id])}
          onToggleSave={() => setSaved((current) => ({ ...current, [route.id]: !current[route.id] }))}
          onBack={onBack}
        />
      ) : null}
      {route.name === 'faq' ? <FaqScreen onBack={onBack} /> : null}
      {route.name === 'myths' ? <MythsScreen onBack={onBack} /> : null}
      {route.name === 'quiz' ? <QuizScreen quizState={quizState} onBack={onBack} onChange={onChange} /> : null}
    </View>
  );
}

function Library({
  initialCategory,
  onChange,
  onArticle,
  onQuiz,
}: {
  initialCategory: LibraryFilter;
  onChange: (route: LearnRoute) => void;
  onArticle: (id: string) => void;
  onQuiz: () => void;
}) {
  const [category, setCategory] = useState<LibraryFilter>(initialCategory);
  const featured = ARTICLES.find((item) => item.featured);
  const showFeatured = featured && (category === 'Todos' || featured.category === category);
  const articles =
    category === 'Todos'
      ? ARTICLES.filter((item) => item.list === 'recent')
      : catalogArticles().filter((item) => item.category === category);

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Aprender</Text>
      <Text style={styles.pageSubtitle}>Conteúdos validados sobre células-tronco, doação e tratamento.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Buscar artigos, doenças, leis"
        onPress={() => onChange({ name: 'search', query: '' })}
        style={styles.search}
      >
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <Text style={styles.searchPlaceholder}>Buscar artigos, doenças, leis...</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CATEGORIES.map((item) => {
          const active = item === category;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setCategory(item)}
              style={[styles.chip, active ? styles.chipOn : styles.chipOff]}
            >
              <Text style={[styles.chipText, active ? styles.chipTextOn : styles.chipTextOff]}>{item}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {showFeatured ? (
        <Pressable accessibilityRole="button" onPress={() => onArticle(featured.id)} style={styles.featured}>
          <Text style={styles.featuredEyebrow}>Em destaque</Text>
          <Text style={styles.featuredTitle}>{featured.title}</Text>
          <Text style={styles.featuredMeta}>
            {featured.category} · {featured.minutes} min de leitura
          </Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" onPress={onQuiz} style={styles.quiz}>
        <View style={styles.quizIcon}>
          <Ionicons name="clipboard-outline" size={18} color={colors.warning700} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.quizTitle}>Não sabe por onde começar?</Text>
          <Text style={styles.quizBody}>Responda 4 perguntas e receba leituras sugeridas.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.warning700} />
      </Pressable>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{category === 'Todos' ? 'Artigos recentes' : category}</Text>
        <Pressable accessibilityRole="button" onPress={() => onChange({ name: 'search', query: '' })}>
          <Text style={styles.link}>Ver todos</Text>
        </Pressable>
      </View>
      {articles.map((article) => (
        <ArticleRow key={article.id} article={article} onPress={() => onArticle(article.id)} />
      ))}
    </ScrollView>
  );
}

function SearchScreen({ initialQuery, onArticle }: { initialQuery: string; onArticle: (id: string) => void }) {
  const [query, setQuery] = useState(initialQuery);
  const results = searchArticles(query);
  const needle = query.trim();

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Aprender</Text>
      <View style={[styles.search, styles.searchField]}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar artigos, doenças, leis..."
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Buscar artigos, doenças, leis"
          style={styles.input}
        />
        {needle ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.resultCount}>
        {needle
          ? `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'} para “${needle}”`
          : 'Todos os conteúdos'}
      </Text>
      {results.length === 0 ? <Text style={styles.empty}>Nenhum conteúdo para “{needle}”.</Text> : null}
      {results.map((article) => (
        <ArticleRow key={article.id} article={article} onPress={() => onArticle(article.id)} />
      ))}
    </ScrollView>
  );
}

function ArticleRow({ article, onPress }: { article: Article; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.article}>
      <View style={[styles.well, { backgroundColor: article.well }]}>
        <Ionicons name={article.icon} size={22} color={article.iconColor} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.articleTitle}>{article.title}</Text>
        <Text style={styles.articleMeta}>{cardMeta(article)}</Text>
      </View>
    </Pressable>
  );
}

function ArticleScreen({
  article,
  saved,
  onToggleSave,
  onBack,
}: {
  article: Article;
  saved: boolean;
  onToggleSave: () => void;
  onBack: () => void;
}) {
  const share = async () => {
    const message = [article.title, '', ...article.sections.map((section) => `${section.title}\n${section.body}`)].join('\n');
    try {
      await Share.share({ message });
    } catch {
      // O usuário fechou a folha de compartilhamento.
    }
  };

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TopBar
        title="Artigo"
        onBack={onBack}
        actionIcon={saved ? 'bookmark' : 'bookmark-outline'}
        actionLabel={saved ? 'Remover dos salvos' : 'Salvar artigo'}
        onAction={onToggleSave}
      />
      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>{article.category}</Text>
        </View>
        <View style={styles.timeChip}>
          <Text style={styles.timeChipText}>{article.minutes} min de leitura</Text>
        </View>
      </View>
      <Text style={styles.articleHeading}>{article.title}</Text>
      {article.validated ? (
        <View style={styles.validated}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success600} />
          <Text style={styles.validatedText}>{article.validated}</Text>
        </View>
      ) : null}
      <View style={styles.hero}>
        <Ionicons name={article.icon} size={42} color={article.iconColor} />
      </View>
      {article.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionHeading}>{section.title}</Text>
          <Text style={styles.paragraph}>{section.body}</Text>
        </View>
      ))}
      <View style={styles.note}>
        <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.noteText}>Fonte: {article.source}</Text>
      </View>
      <View style={[styles.note, styles.disclaimer]}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primary600} />
        <Text style={styles.disclaimerText}>Conteúdo educativo. Não substitui orientação médica.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onToggleSave} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{saved ? 'Salvo' : 'Salvar'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={share} style={[styles.primaryButton, styles.shareButton]}>
          <Text style={styles.primaryButtonText}>Compartilhar</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function FaqScreen({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(FAQS[0].id);
  const needle = fold(query.trim());
  const items = FAQS.filter((item) => !needle || fold(`${item.question} ${item.answer}`).includes(needle));

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TopBar title="Perguntas frequentes" onBack={onBack} />
      <View style={[styles.search, styles.searchField]}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar dúvida..."
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Buscar dúvida"
          style={styles.input}
        />
      </View>
      {items.length === 0 ? <Text style={styles.empty}>Nenhuma pergunta para “{query.trim()}”.</Text> : null}
      {items.map((item) => {
        const open = item.id === openId;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpenId(open ? null : item.id)}
            style={[styles.faq, open && styles.faqOpen]}
          >
            <View style={styles.faqHead}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Ionicons name={open ? 'close' : 'add'} size={20} color={colors.ink} />
            </View>
            {open ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MythsScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TopBar title="Mitos e verdades" onBack={onBack} />
      {MYTHS.map((item) => {
        const truth = item.tag === 'Verdade';
        return (
          <View key={item.quote} style={styles.myth}>
            <View style={[styles.tag, { backgroundColor: truth ? colors.success100 : colors.danger100 }]}>
              <Text style={[styles.tagText, { color: truth ? colors.success600 : colors.danger600 }]}>{item.tag}</Text>
            </View>
            <Text style={styles.mythQuote}>{item.quote}</Text>
            <Text style={styles.mythBody}>{item.body}</Text>
          </View>
        );
      })}
      <View style={styles.note}>
        <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.noteText}>Fonte: INCA / REDOME · Atualizado em 09/2026</Text>
      </View>
    </ScrollView>
  );
}

const QUIZ = [
  {
    prompt: 'O que você quer agora?',
    options: [
      { id: 'basico', label: 'Entender o básico', article: 'o-que-sao' },
      { id: 'doar', label: 'Saber como doar', article: 'doacao-passo-a-passo' },
      { id: 'tratamento', label: 'Entender um tratamento', article: 'leucemia' },
      { id: 'leis', label: 'Conhecer leis e o REDOME', article: 'redome' },
    ],
  },
  {
    prompt: 'Qual dúvida aparece primeiro?',
    options: [
      { id: 'dor', label: 'Se a doação dói', article: 'doer' },
      { id: 'coluna', label: 'Se tiram um pedaço da coluna', article: 'periferico' },
      { id: 'quem', label: 'Quem pode se cadastrar', article: 'doacao-passo-a-passo' },
      { id: 'paga', label: 'Quem paga o transplante', article: 'lei-9434' },
    ],
  },
  {
    prompt: 'Quanto tempo você tem para ler?',
    options: [
      { id: 'curto', label: 'Uns 3 minutos', article: 'periferico' },
      { id: 'medio', label: 'Uns 5 minutos', article: 'o-que-sao' },
    ],
  },
  {
    prompt: 'Qual formato você prefere?',
    options: [
      { id: 'artigo', label: 'Um artigo', article: '' },
      { id: 'mitos', label: 'Mitos e verdades', article: '' },
      { id: 'faq', label: 'Perguntas frequentes', article: '' },
    ],
  },
] as const;

function QuizScreen({
  quizState,
  onBack,
  onChange,
}: {
  quizState: { current: { step: number; picks: string[] } };
  onBack: () => void;
  onChange: (route: LearnRoute) => void;
}) {
  const [step, setStep] = useState(quizState.current.step);
  const [picks, setPicks] = useState<string[]>(quizState.current.picks);
  useEffect(() => {
    quizState.current = { step, picks };
  }, [quizState, step, picks]);
  const done = step >= QUIZ.length;
  const current = QUIZ[Math.min(step, QUIZ.length - 1)];
  const selected = picks[step];

  if (done) {
    const primary = articleById(QUIZ[0].options.find((option) => option.id === picks[0])?.article || 'o-que-sao');
    const second = articleById(QUIZ[1].options.find((option) => option.id === picks[1])?.article || 'doer');
    const format = picks[3];
    return (
      <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TopBar title="Leituras sugeridas" onBack={onBack} />
        <Text style={styles.paragraph}>Com as suas respostas, estes são os melhores pontos de partida.</Text>
        <ArticleRow article={primary} onPress={() => onChange({ name: 'article', id: primary.id })} />
        <ArticleRow article={second} onPress={() => onChange({ name: 'article', id: second.id })} />
        {format === 'mitos' ? (
          <Pressable accessibilityRole="button" onPress={() => onChange({ name: 'myths' })} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Abrir mitos e verdades</Text>
          </Pressable>
        ) : null}
        {format === 'faq' ? (
          <Pressable accessibilityRole="button" onPress={() => onChange({ name: 'faq' })} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Abrir perguntas frequentes</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TopBar title="Por onde começar" onBack={onBack} />
      <Text style={styles.stepLabel}>Pergunta {step + 1} de {QUIZ.length}</Text>
      <Text style={styles.articleHeading}>{current.prompt}</Text>
      {current.options.map((option) => {
        const active = option.id === selected;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => setPicks((currentPicks) => {
              const next = currentPicks.slice(0, step);
              next[step] = option.id;
              return next;
            })}
            style={[styles.option, active && styles.optionOn]}
          >
            <Text style={styles.optionText}>{option.label}</Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        disabled={!selected}
        onPress={() => setStep((value) => value + 1)}
        style={[styles.primaryButton, !selected && styles.buttonDisabled]}
      >
        <Text style={styles.primaryButtonText}>{step === QUIZ.length - 1 ? 'Ver sugestões' : 'Continuar'}</Text>
      </Pressable>
    </ScrollView>
  );
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  pageTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.ink },
  pageSubtitle: { marginTop: 4, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  search: {
    marginTop: 16,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchField: { paddingVertical: 8 },
  searchPlaceholder: { flex: 1, fontSize: 16, lineHeight: 22, color: colors.textTertiary },
  input: { flex: 1, fontSize: 16, lineHeight: 22, color: colors.ink, paddingVertical: 0 },
  chips: { gap: 6, paddingTop: 12 },
  chip: { height: 32, borderRadius: 999, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary600 },
  chipOff: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderSubtle },
  chipText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  chipTextOn: { color: '#FFFFFF' },
  chipTextOff: { color: colors.textSecondary },
  featured: { marginTop: 16, borderRadius: 20, backgroundColor: colors.primary600, padding: 16 },
  featuredEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  featuredTitle: { marginTop: 6, fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#FFFFFF' },
  featuredMeta: { marginTop: 6, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)' },
  quiz: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: colors.warning100,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quizIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.warning700 },
  quizBody: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.warning700 },
  sectionHead: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.ink },
  link: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: colors.primary600 },
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
  well: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  articleTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.ink },
  articleMeta: { marginTop: 2, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  resultCount: { marginTop: 16, marginBottom: 12, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  empty: { marginTop: 8, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaChip: { backgroundColor: colors.primary100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  metaChipText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.primary600 },
  timeChip: { backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  timeChipText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.textSecondary },
  articleHeading: { marginTop: 12, fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  validated: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  validatedText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  hero: {
    marginTop: 16,
    height: 140,
    borderRadius: 16,
    backgroundColor: colors.primary50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 18 },
  sectionHeading: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.ink },
  paragraph: { marginTop: 6, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  note: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  disclaimer: { backgroundColor: colors.primary50 },
  disclaimerText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.primary600 },
  actions: { marginTop: 16, flexDirection: 'row', gap: 10 },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  primaryButton: {
    height: 48,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: colors.primary600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: { flex: 1.4, marginTop: 0 },
  primaryButtonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#FFFFFF' },
  buttonDisabled: { opacity: 0.45 },
  faq: { borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: 14, marginBottom: 10 },
  faqOpen: { backgroundColor: colors.primary50, borderColor: colors.primary50 },
  faqHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  faqQuestion: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  faqAnswer: { marginTop: 8, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  myth: { borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: 14, marginBottom: 12 },
  tag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  mythQuote: { marginTop: 10, fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.ink },
  mythBody: { marginTop: 6, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  stepLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.primary600 },
  option: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  optionOn: { backgroundColor: colors.primary50, borderColor: colors.primary600 },
  optionText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
});
