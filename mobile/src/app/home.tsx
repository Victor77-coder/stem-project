import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LearnFlow, type LearnRoute } from '@/components/learn/LearnFlow';
import { TabBar, type TabId } from '@/components/TabBar';
import {
  ArticleList,
  CampaignCard,
  EstimateCard,
  HomeHeader,
  JourneyCard,
  ProfileInvite,
  QuickGrid,
  SectionTitle,
  Soon,
  shell,
} from '@/components/home/parts';
import { useRegistration, type ProfileType, type Sexo } from '@/context/RegistrationContext';
import { colors } from '@/theme';

function firstName(name: string, fallback: string) {
  return name.trim().split(/\s+/)[0] || fallback;
}

function resolveProfile(query: string | string[] | undefined, saved: ProfileType | null): ProfileType {
  const value = Array.isArray(query) ? query[0] : query;
  if (value === 'doador' || value === 'receptor' || value === 'leigo') return value;
  return saved ?? 'doador';
}

function DonorHome({ name, sex, open }: { name: string; sex: Sexo; open: (route: LearnRoute) => void }) {
  return (
    <>
      <HomeHeader
        greeting={`Olá, ${firstName(name, 'Maria')}`}
        chip={sex === 'masculino' ? 'Doador' : 'Doadora'}
        chipBg={colors.primary100}
        chipFg={colors.primary600}
        subtitle="Que bom ter você por aqui. Veja seus próximos passos."
      />
      <JourneyCard
        background={colors.primary600}
        accent={colors.primary600}
        eyebrow="Sua jornada de doação"
        title="Etapa 2 de 6 · Coleta de amostra"
        body="Leve um documento com foto ao hemocentro para coletar a amostra de sangue do cadastro."
        progress="33%"
        action="Ver minha jornada"
      />
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
          { title: 'Centros perto de\nmim', icon: 'location-outline', iconColor: colors.teal600, well: colors.teal100 },
          { title: 'Questionário de\norientação', icon: 'clipboard-outline', iconColor: colors.warning700, well: colors.warning100 },
          { title: 'Estatísticas do\nBrasil', icon: 'bar-chart-outline', iconColor: colors.textSecondary, well: colors.surfaceMuted },
        ]}
      />
      <SectionTitle link="Ver todas">Campanhas perto de você</SectionTitle>
      <CampaignCard />
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

function ReceptorHome({ name, sex, open }: { name: string; sex: Sexo; open: (route: LearnRoute) => void }) {
  return (
    <>
      <HomeHeader
        greeting={`Olá, ${firstName(name, 'João')}`}
        chip={sex === 'feminino' ? 'Receptora' : 'Receptor'}
        chipBg={colors.teal100}
        chipFg={colors.teal600}
        subtitle="Você não está sozinho. Acompanhe cada etapa do seu tratamento."
      />
      <JourneyCard
        background={colors.success}
        accent={colors.success}
        eyebrow="Sua jornada de tratamento"
        title="Etapa 3 de 6 · Busca de doador compatível"
        body="Seu cadastro foi enviado pela equipe médica. A busca é feita pelo SUS no REDOME."
        progress="50%"
        action="Ver minha jornada"
      />
      <EstimateCard />
      <SectionTitle>Acesso rápido</SectionTitle>
      <QuickGrid
        items={[
          { title: 'Centros\ntransplantadores', icon: 'document-text-outline', iconColor: colors.teal600, well: colors.teal100 },
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

function LeigoHome({ open }: { open: (route: LearnRoute) => void }) {
  return (
    <>
      <HomeHeader
        greeting="Olá!"
        chip="Visitante"
        chipBg={colors.surfaceMuted}
        chipFg={colors.textSecondary}
        subtitle="Explore conteúdos sobre células-tronco sem precisar de cadastro."
      />
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
          { title: 'Centros e\ncampanhas', icon: 'location-outline', iconColor: colors.teal600, well: colors.teal100 },
          { title: 'Estatísticas do\nBrasil', icon: 'bar-chart-outline', iconColor: colors.textSecondary, well: colors.surfaceMuted },
        ]}
      />
      <ProfileInvite onPress={() => router.push('/profile')} />
      <SectionTitle link="Ver todas">Campanhas perto de você</SectionTitle>
      <CampaignCard />
    </>
  );
}

export default function HomeScreen() {
  const { draft } = useRegistration();
  const { perfil } = useLocalSearchParams<{ perfil?: string }>();
  const [tab, setTab] = useState<TabId>('inicio');
  const [learnStack, setLearnStack] = useState<LearnRoute[]>([{ name: 'library' }]);
  const profile = resolveProfile(perfil, draft.profile);
  const learn = learnStack[learnStack.length - 1];

  function openLearn(route: LearnRoute) {
    setLearnStack(route.name === 'library' ? [route] : [{ name: 'library' }, route]);
    setTab('aprender');
  }

  function onTab(id: TabId) {
    setTab(id);
    if (id === 'aprender') setLearnStack([{ name: 'library' }]);
  }

  return (
    <View style={shell.shell}>
      <SafeAreaView style={shell.phone} edges={['top']}>
        {tab === 'inicio' ? (
          <ScrollView style={shell.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={shell.content}>
            {profile === 'receptor' ? (
              <ReceptorHome name={draft.name} sex={draft.sex} open={openLearn} />
            ) : profile === 'leigo' ? (
              <LeigoHome open={openLearn} />
            ) : (
              <DonorHome name={draft.name} sex={draft.sex} open={openLearn} />
            )}
          </ScrollView>
        ) : tab === 'aprender' ? (
          <LearnFlow
            route={learn}
            onChange={(route) => setLearnStack((current) => [...current, route])}
            onBack={() => setLearnStack((current) => (current.length > 1 ? current.slice(0, -1) : current))}
          />
        ) : (
          <Soon title={tab === 'jornada' ? 'Jornada' : tab === 'centros' ? 'Centros' : 'Perfil'} />
        )}
        <TabBar value={tab} onChange={onTab} />
      </SafeAreaView>
    </View>
  );
}
