import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { RegistrationProvider } from '@/context/RegistrationContext';

export default function RootLayout() {
  return (
    <RegistrationProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="leigo" />
        <Stack.Screen name="register" />
        <Stack.Screen name="physical" />
        <Stack.Screen name="location" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="tcle" />
        <Stack.Screen name="review" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="conclusion" />
        <Stack.Screen name="home" />
      </Stack>
    </RegistrationProvider>
  );
}
