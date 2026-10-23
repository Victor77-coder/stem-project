import type { ConfigContext, ExpoConfig } from 'expo/config';

// A chave do Google Maps (Android) só é exigida no build distribuído; no Expo Go o mapa funciona sem ela.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '' }],
  ],
});
