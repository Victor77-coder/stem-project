import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { api } from '@/lib/api';

// O projectId vem do `eas init` (docs/notificacoes.md). Sem ele, ou na web, o app nem pede permissão.
const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

export const pushAvailable = Platform.OS !== 'web' && Boolean(projectId);

if (pushAvailable) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

let registered: string | null = null;

async function deviceToken(ask: boolean): Promise<string | null> {
  if (!pushAvailable) return null;
  // No Android 13+, o pedido de permissão só aparece depois de existir um canal.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Avisos',
      importance: AndroidImportance.DEFAULT,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/** Registra o aparelho na conta. Com `ask`, pede a permissão do sistema. Devolve se ficou registrado. */
export async function registerDevice(ask: boolean): Promise<boolean> {
  try {
    const token = await deviceToken(ask);
    if (!token) return false;
    await api('/me/push-tokens/', { method: 'POST', body: { token, platform: Platform.OS } });
    registered = token;
    return true;
  } catch {
    return false;
  }
}

/** Liga o canal push: o servidor só aceita depois que o aparelho foi registrado. */
export async function turnOnPush(): Promise<boolean> {
  if (!(await registerDevice(true))) return false;
  await api('/me/preferences/', { method: 'PATCH', body: { push: true } });
  return true;
}

/** No logout, o aparelho deixa de receber os avisos da conta. */
export async function forgetDevice(): Promise<void> {
  const token = registered ?? (await deviceToken(false).catch(() => null));
  registered = null;
  if (token) await api('/me/push-tokens/', { method: 'DELETE', body: { token } }).catch(() => undefined);
}

/** Toque na notificação abre a caixa de entrada, inclusive com o app fechado. */
export function onNoticeOpened(open: () => void): () => void {
  if (!pushAvailable) return () => undefined;
  const handle = () => {
    Notifications.clearLastNotificationResponse();
    open();
  };
  if (Notifications.getLastNotificationResponse()) handle();
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
