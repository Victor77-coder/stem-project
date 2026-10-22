import { Redirect } from 'expo-router';
import { useRegistration } from '@/context/RegistrationContext';

export default function Index() {
  const { restoring, signedIn } = useRegistration();
  if (restoring) return null;
  return <Redirect href={signedIn ? '/home' : '/onboarding'} />;
}
