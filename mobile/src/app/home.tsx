import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CentersFlow } from '@/components/centers/CentersFlow';
import { InsightsFlow, type ApiNotice, type InsightScreen } from '@/components/insights/InsightsFlow';
import { JourneyFlow } from '@/components/journey/JourneyFlow';
import { LearnFlow, type LearnRoute } from '@/components/learn/LearnFlow';
import { OrientationFlow } from '@/components/orientation/OrientationFlow';
import { ProfileFlow } from '@/components/profile/ProfileFlow';
import { TabBar, type TabId } from '@/components/TabBar';
import { type CenterFilter } from '@/content/centers';
import {
  NO_MARKS,
  doneCount,
  loadSteps,
  progressPercent,
  stepStates,
  stepsFor,
  type JourneyMarks,
  type JourneyStep,
  type RegionId,
} from '@/content/journey';
import {
  ArticleList,
  CampaignSection,
  HomeHeader,
  JourneyCard,
  NoticeInvite,
  ProfileInvite,
  QuickGrid,
  SectionTitle,
  shell,
} from '@/components/home/parts';
import { useRegistration, type ProfileType, type Sexo } from '@/context/RegistrationContext';
import { api, withFallback } from '@/lib/api';
import { onNoticeOpened } from '@/lib/push';
import { colors } from '@/theme';

/** Sem nome no cadastro, a saudação fica neutra (RS008: nada de nome de exemplo). */
function greeting(name: string) {
  const first = name.trim().split(/\s+/)[0];
  return first ? `Olá, ${first}` : 'Olá!';
}

function resolveProfile(query: string | string[] | undefined, saved: ProfileType | null): ProfileType {
  const value = Array.isArray(query) ? query[0] : query;
  if (value === 'doador' || value === 'receptor' || value === 'convidado') return value;
  return saved ?? 'doador';
}

/** Cartão do guia pessoal: mostra a primeira etapa que o usuário ainda não marcou. */
function homeCard(steps: JourneyStep[], marks: JourneyMarks) {
  const next = stepStates(steps, marks.done).indexOf('next');
  if (next < 0) {
    return {
      title: 'Todas as etapas marcadas',
      body: 'Você marcou todas as etapas do guia. Siga as orientações do hemocentro ou da equipe médica.',
      progress: '100%' as const,
    };
  }
  const step = steps[next];
  return {
    title: `Etapa ${next + 1} de ${steps.length} · ${step.shortTitle}`,
    body: step.homeBody ?? step.summary,
    progress: progressPercent(doneCount(steps, marks.done), steps.length),
  };
}

function DonorHome({
  name,
  sex,
  uf,
  marks,
  steps,
  unread,
  open,
  onJourney,
  onQuestionnaire,
  onCenters,
  onStats,
  onNotifications,
  onNoticeInvite,
}: {
  name: string;
  sex: Sexo;
  uf: string;
  marks: JourneyMarks;
  steps: JourneyStep[];
  unread: number;
  open: (route: LearnRoute) => void;
  /** Ausente quando o painel desligou a Jornada: o cartão some da tela inicial. */
  onJourney?: () => void;
  onQuestionnaire: () => void;
  onCenters: (filter?: CenterFilter) => void;
  onStats: () => void;
  onNotifications: () => void;
  onNoticeInvite?: () => void;
}) {
  const card = homeCard(steps, marks);
  return (
    <>
      <HomeHeader
        greeting={greeting(name)}
        chip={sex === 'feminino' ? 'Doadora' : 'Doador'}
        chipBg={colors.primary100}
        chipFg={colors.primary600}
        subtitle="Que bom ter você por aqui. Veja seus próximos passos."
        unread={unread}
        onNotifications={onNotifications}
      />
      {onNoticeInvite ? <NoticeInvite onPress={onNoticeInvite} /> : null}
      {onJourney && (
        <JourneyCard
          background={colors.primary600}
          accent={colors.primary600}
          eyebrow="Sua jornada de doação"
          title={card.title}
          body={card.body}
          progress={card.progress}
          action="Ver minha jornada"
          onAction={onJourney}
        />
      )}
      <SectionTitle>Acesso rápido</SectionTitle>
      <QuickGrid
        items={[
          {
            title: 'Aprender sobre\ncélulas-tronco',
            icon: 'book-outline',
            iconColor: colors.primary600,
            well: colors.primary100,
            onPress: () => open({ name: 'library' }),
          },
          {
            title: 'Centros perto de\nmim',
            icon: 'location-outline',
            iconColor: colors.teal600,
            well: colors.teal100,
            onPress: () => onCenters(),
          },
          {
            title: 'Questionário de\norientação',
            icon: 'clipboard-outline',
            iconColor: colors.warning700,
            well: colors.warning100,
            onPress: onQuestionnaire,
          },
          {
            title: 'Estatísticas do\nBrasil',
            icon: 'bar-chart-outline',
            iconColor: colors.textSecondary,
            well: colors.surfaceMuted,
            onPress: onStats,
          },
        ]}
      />
      <CampaignSection uf={uf} onOpen={() => onCenters('campanha')} />
      <SectionTitle link="Ver mais" onLink={() => open({ name: 'library' })}>
        Recomendado para você
      </SectionTitle>
      <ArticleList
        items={[
          {
            title: 'Como funciona a doação de medula óssea',
            meta: 'Conceito · 4 min de leitura',
            icon: 'git-network-outline',
            iconColor: colors.primary600,
            well: colors.primary100,
            onPress: () => open({ name: 'article', id: 'doacao-passo-a-passo' }),
          },
          {
            title: 'Mitos e verdades sobre doar células-tronco',
            meta: 'Mitos · 3 min de leitura',
            icon: 'bulb-outline',
            iconColor: colors.warning700,
            well: colors.warning100,
            onPress: () => open({ name: 'myths' }),
          },
        ]}
      />
    </>
  );
}

function ReceptorHome({
  name,
  sex,
  marks,
  steps,
  unread,
  open,
  onJourney,
  onQuestionnaire,
  onCenters,
  onStats,
  onNotifications,
  onNoticeInvite,
}: {
  name: string;
  sex: Sexo;
  marks: JourneyMarks;
  steps: JourneyStep[];
  unread: number;
  open: (route: LearnRoute) => void;
  /** Ausente quando o painel desligou a Jornada: o cartão some da tela inicial. */
  onJourney?: () => void;
  onQuestionnaire: () => void;
  onCenters: (filter?: CenterFilter) => void;
  onStats: () => void;
  onNotifications: () => void;
  onNoticeInvite?: () => void;
}) {
  const card = homeCard(steps, marks);
  return (
    <>
      <HomeHeader
        greeting={greeting(name)}
        chip={sex === 'feminino' ? 'Receptora' : 'Receptor'}
        chipBg={colors.teal100}
        chipFg={colors.teal600}
        subtitle="Você não está sozinho. Acompanhe cada etapa do seu tratamento."
        unread={unread}
        onNotifications={onNotifications}
      />
      {onNoticeInvite ? <NoticeInvite onPress={onNoticeInvite} /> : null}
      {onJourney && (
        <JourneyCard
          background={colors.success}
          accent={colors.success}
          eyebrow="Sua jornada de tratamento"
          title={card.title}
          body={card.body}
          progress={card.progress}
          action="Ver minha jornada"
          onAction={onJourney}
        />
      )}
      <SectionTitle>Acesso rápido</SectionTitle>
      <QuickGrid
        items={[
          {
            title: 'Centros\ntransplantadores',
            icon: 'document-text-outline',
            iconColor: colors.teal600,
            well: colors.teal100,
            onPress: () => onCenters('transplante'),
          },
          {
            title: 'Entenda seu\ntratamento',
            icon: 'book-outline',
            iconColor: colors.primary600,
            well: colors.primary100,
            onPress: () => open({ name: 'library' }),
          },
          {
            title: 'Direitos e leis no\nBrasil',
            icon: 'scale-outline',
            iconColor: colors.textSecondary,
            well: colors.surfaceMuted,
            onPress: () => open({ name: 'library', category: 'Leis no Brasil' }),
          },
          {
            title: 'Apoio e dúvidas\nfrequentes',
            icon: 'help-circle-outline',
            iconColor: colors.warning700,
            well: colors.warning100,
            onPress: () => open({ name: 'faq' }),
          },
          {
            title: 'Questionário de\norientação',
            icon: 'clipboard-outline',
            iconColor: colors.warning700,
            well: colors.warning100,
            onPress: onQuestionnaire,
          },
          // Sem o cartão de estimativa (RF12 desejável), o atalho para Estatísticas vem para o acesso rápido.
          {
            title: 'Estatísticas do\nBrasil',
            icon: 'bar-chart-outline',
            iconColor: colors.textSecondary,
            well: colors.surfaceMuted,
            onPress: onStats,
          },
        ]}
      />
      <SectionTitle link="Ver mais" onLink={() => open({ name: 'library' })}>
        Recomendado para você
      </SectionTitle>
      <ArticleList
        items={[
          {
            title: 'O que é o transplante de medula (TCTH)',
            meta: 'Doenças · 5 min de leitura',
            icon: 'pulse-outline',
            iconColor: colors.teal600,
            well: colors.teal100,
            onPress: () => open({ name: 'article', id: 'tcth' }),
          },
          {
            title: 'Como funciona a fila de transplantes no SUS',
            meta: 'Leis no Brasil · 4 min',
            icon: 'scale-outline',
            iconColor: colors.textSecondary,
            well: colors.surfaceMuted,
            onPress: () => open({ name: 'article', id: 'fila-sus' }),
          },
        ]}
      />
    </>
  );
}

function ConvidadoHome({
  unread,
  open,
  onQuestionnaire,
  onCenters,
  onStats,
  onNotifications,
  onNoticeInvite,
}: {
  unread: number;
  open: (route: LearnRoute) => void;
  onQuestionnaire: () => void;
  onCenters: (filter?: CenterFilter) => void;
  onStats: () => void;
  onNotifications: () => void;
  onNoticeInvite?: () => void;
}) {
  return (
    <>
      <HomeHeader
        greeting="Olá!"
        chip="Convidado"
        chipBg={colors.surfaceMuted}
        chipFg={colors.textSecondary}
        subtitle="Explore conteúdos sobre células-tronco sem precisar de cadastro."
        unread={unread}
        onNotifications={onNotifications}
      />
      {onNoticeInvite ? <NoticeInvite onPress={onNoticeInvite} /> : null}
      <JourneyCard
        background={colors.primary900}
        accent={colors.primary900}
        eyebrow="Comece por aqui"
        title="O que são células-tronco?"
        body="Entenda em 3 minutos como elas funcionam e por que salvam vidas."
        action="Ler agora"
        onAction={() => open({ name: 'article', id: 'o-que-sao' })}
      />
      <SectionTitle>Acesso rápido</SectionTitle>
      <QuickGrid
        items={[
          {
            title: 'Biblioteca de\nconteúdos',
            icon: 'book-outline',
            iconColor: colors.primary600,
            well: colors.primary100,
            onPress: () => open({ name: 'library' }),
          },
          {
            title: 'Mitos e verdades',
            icon: 'bulb-outline',
            iconColor: colors.warning700,
            well: colors.warning100,
            onPress: () => open({ name: 'myths' }),
          },
          {
            title: 'Centros e\ncampanhas',
            icon: 'location-outline',
            iconColor: colors.teal600,
            well: colors.teal100,
            onPress: () => onCenters(),
          },
          {
            title: 'Questionário de\norientação',
            icon: 'clipboard-outline',
            iconColor: colors.warning700,
            well: colors.warning100,
            onPress: onQuestionnaire,
          },
          {
            title: 'Estatísticas do\nBrasil',
            icon: 'bar-chart-outline',
            iconColor: colors.textSecondary,
            well: colors.surfaceMuted,
            onPress: onStats,
          },
        ]}
      />
      <ProfileInvite onPress={() => router.push('/profile')} />
      <CampaignSection onOpen={() => onCenters('campanha')} />
    </>
  );
}

export default function HomeScreen() {
  const { draft, update, save, signedIn } = useRegistration();
  const { perfil } = useLocalSearchParams<{ perfil?: string }>();
  const [tab, setTab] = useState<TabId>('inicio');
  const [orientation, setOrientation] = useState(false);
  const [learnStack, setLearnStack] = useState<LearnRoute[]>([{ name: 'library' }]);
  // Guia pessoal (RF05/RF06): as marcas são do perfil salvo na conta e começam vazias.
  const [journey, setJourney] = useState<JourneyMarks & { kind: ProfileType | null; region: RegionId }>({
    kind: null,
    region: 'maceio',
    ...NO_MARKS,
  });
  const [centersFilter, setCentersFilter] = useState<CenterFilter>('todos');
  const [insight, setInsight] = useState<InsightScreen | null>(null);
  const [unread, setUnread] = useState(0);
  // A Jornada aparece por padrão; o painel ainda pode ocultá-la. Sem conexão, continua visível (RNF08).
  const [journeyOn, setJourneyOn] = useState(true);
  const [channelsOff, setChannelsOff] = useState(false);
  const profile = resolveProfile(perfil, draft.profile);
  const learn = learnStack[learnStack.length - 1];
  const journeyKind = profile === 'convidado' ? 'convidado' : profile;
  // Com ?perfil= de outro perfil (pré-visualização), o guia aparece vazio e nada é gravado.
  const ownJourney = signedIn && journey.kind === profile;
  const marks: JourneyMarks = ownJourney ? journey : NO_MARKS;
  const stepsKind = journeyKind === 'receptor' ? 'receptor' : 'doador';
  // Etapas publicadas no painel para este perfil e região; até a API responder, as embarcadas no app.
  const stepsKey = `${stepsKind}:${journey.region}`;
  const [loadedSteps, setLoadedSteps] = useState<{ key: string; steps: JourneyStep[] } | null>(null);
  const steps = loadedSteps?.key === stepsKey ? loadedSteps.steps : stepsFor(stepsKind, journey.region);

  useEffect(() => {
    withFallback('/config/', { jornadaAtiva: true }).then(({ jornadaAtiva }) => {
      const on = jornadaAtiva === true;
      setJourneyOn(on);
      if (!on) setTab((current) => (current === 'jornada' ? 'inicio' : current));
    });
  }, []);

  useEffect(() => {
    let alive = true;
    loadSteps(stepsKind, journey.region).then((loaded) => {
      if (alive) setLoadedSteps({ key: `${stepsKind}:${journey.region}`, steps: loaded });
    });
    return () => {
      alive = false;
    };
  }, [stepsKind, journey.region]);

  useEffect(() => {
    // Recarrega também na troca de perfil: o guia do novo perfil começa sem marcas.
    if (!signedIn) return;
    api<JourneyMarks & { kind: ProfileType; region: RegionId }>('/me/journey/')
      .then(({ kind, region, done, checklist }) => setJourney({ kind, region, done, checklist }))
      .catch(() => undefined);
  }, [signedIn, draft.profile]);

  useEffect(() => {
    if (!signedIn) return;
    api<ApiNotice[]>('/me/inbox/')
      .then((items) => setUnread(items.filter((item) => !item.read).length))
      .catch(() => undefined);
  }, [signedIn]);

  useEffect(() => {
    // Recarrega ao voltar das Preferências: o convite some assim que um canal é ligado.
    if (!signedIn || insight) return;
    api<{ push: boolean; email: boolean }>('/me/preferences/')
      .then((prefs) => setChannelsOff(!prefs.push && !prefs.email))
      .catch(() => undefined);
  }, [signedIn, insight]);

  useEffect(
    () =>
      onNoticeOpened(() => {
        setOrientation(false);
        setTab('inicio');
        setInsight('inbox');
      }),
    [],
  );

  function saveJourney(patch: Partial<JourneyMarks & { region: RegionId }>) {
    setJourney((value) => ({ ...value, ...patch }));
    if (ownJourney) api('/me/journey/', { method: 'PATCH', body: patch }).catch(() => undefined);
  }

  function toggleStep(stepId: string) {
    const done = marks.done.includes(stepId) ? marks.done.filter((id) => id !== stepId) : [...marks.done, stepId];
    saveJourney({ done });
  }

  function toggleItem(stepId: string, label: string) {
    const items = marks.checklist[stepId] ?? [];
    const next = items.includes(label) ? items.filter((item) => item !== label) : [...items, label];
    saveJourney({ checklist: { ...marks.checklist, [stepId]: next } });
  }

  function openLearn(route: LearnRoute) {
    setLearnStack(route.name === 'library' ? [route] : [{ name: 'library' }, route]);
    setTab('aprender');
  }

  function onTab(id: TabId) {
    setOrientation(false);
    setInsight(null);
    setTab(id);
    if (id === 'aprender') setLearnStack([{ name: 'library' }]);
    if (id === 'centros') setCentersFilter('todos');
  }

  function openCenters(filter: CenterFilter = 'todos') {
    setOrientation(false);
    setInsight(null);
    setCentersFilter(filter);
    setTab('centros');
  }

  function openInsight(screen: InsightScreen) {
    setOrientation(false);
    setTab('inicio');
    setInsight(screen);
  }

  function openFromQuestionnaire(route: LearnRoute) {
    setOrientation(false);
    openLearn(route);
  }

  function openJourney() {
    setOrientation(false);
    setTab('jornada');
  }

  return (
    <View style={shell.shell}>
      <SafeAreaView style={shell.phone} edges={['top']}>
        {tab === 'inicio' && insight ? (
          <InsightsFlow
            initial={insight}
            profile={profile}
            email={draft.email}
            onClose={() => setInsight(null)}
            onUnread={setUnread}
          />
        ) : tab === 'inicio' && orientation ? (
          <OrientationFlow
            profile={profile}
            uf={draft.uf}
            onClose={() => setOrientation(false)}
            onLearn={openFromQuestionnaire}
            onCenters={() => {
              setOrientation(false);
              openCenters();
            }}
          />
        ) : tab === 'inicio' ? (
          <ScrollView style={shell.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={shell.content}>
            {profile === 'receptor' ? (
              <ReceptorHome
                name={draft.name}
                sex={draft.sex}
                marks={marks}
                steps={steps}
                unread={unread}
                open={openLearn}
                onJourney={journeyOn ? openJourney : undefined}
                onQuestionnaire={() => setOrientation(true)}
                onCenters={openCenters}
                onStats={() => openInsight('stats')}
                onNotifications={() => openInsight('inbox')}
                onNoticeInvite={signedIn && channelsOff ? () => openInsight('prefs') : undefined}
              />
            ) : profile === 'convidado' ? (
              <ConvidadoHome
                unread={unread}
                open={openLearn}
                onQuestionnaire={() => setOrientation(true)}
                onCenters={openCenters}
                onStats={() => openInsight('stats')}
                onNotifications={() => openInsight('inbox')}
                onNoticeInvite={signedIn && channelsOff ? () => openInsight('prefs') : undefined}
              />
            ) : (
              <DonorHome
                name={draft.name}
                sex={draft.sex}
                uf={draft.uf}
                marks={marks}
                steps={steps}
                unread={unread}
                open={openLearn}
                onJourney={journeyOn ? openJourney : undefined}
                onQuestionnaire={() => setOrientation(true)}
                onCenters={openCenters}
                onStats={() => openInsight('stats')}
                onNotifications={() => openInsight('inbox')}
                onNoticeInvite={signedIn && channelsOff ? () => openInsight('prefs') : undefined}
              />
            )}
          </ScrollView>
        ) : tab === 'aprender' ? (
          <LearnFlow
            route={learn}
            profile={profile}
            onChange={(route) => setLearnStack((current) => [...current, route])}
            onBack={() => setLearnStack((current) => (current.length > 1 ? current.slice(0, -1) : current))}
          />
        ) : tab === 'jornada' ? (
          <JourneyFlow
            kind={journeyKind}
            steps={steps}
            marks={marks}
            region={journey.region}
            onRegion={(region) => saveJourney({ region })}
            onToggleStep={toggleStep}
            onToggleItem={toggleItem}
            onChooseProfile={(next) => {
              update({ profile: next });
              router.push('/profile');
            }}
          />
        ) : tab === 'centros' ? (
          <CentersFlow
            initialFilter={centersFilter}
            profile={profile}
            savedCity={draft.city}
            savedUf={draft.uf}
            savedCep={draft.cep}
            allowed={draft.allowLocation}
            onAllowLocation={() => void save({ allowLocation: true }).catch(() => update({ allowLocation: true }))}
          />
        ) : (
          <ProfileFlow
            profile={profile}
            onNotifications={() => openInsight('prefs')}
            onCenters={() => openCenters()}
            onChooseProfile={() => router.push('/profile')}
          />
        )}
        <TabBar value={tab} onChange={onTab} hidden={journeyOn ? [] : ['jornada']} />
      </SafeAreaView>
    </View>
  );
}
