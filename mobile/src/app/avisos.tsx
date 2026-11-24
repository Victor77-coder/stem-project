import { router } from 'expo-router';
import { Logo } from '@/components/Logo';
import { NavPair } from '@/components/NavPair';
import { NoticeChoices } from '@/components/NoticeChoices';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { useRegistration } from '@/context/RegistrationContext';

export default function NoticesScreen() {
  const { draft, update, totalSteps } = useRegistration();

  return (
    <Screen
      footer={
        <NavPair
          onLeft={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/location');
          }}
          onRight={() => router.push('/review')}
        />
      }
    >
      <StepHeader
        title="Quer receber avisos?"
        subtitle="Campanhas de doação, eventos e comunicados oficiais da sua região. Tudo começa desligado: você escolhe."
        step={6}
        total={totalSteps}
        brand={<Logo />}
      />
      <NoticeChoices value={draft.notices} onChange={(notices) => update({ notices })} email={draft.email} />
    </Screen>
  );
}
