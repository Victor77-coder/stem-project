import type { Ionicons } from '@expo/vector-icons';
import type { CenterKind } from '@/content/centers';
import { colors } from '@/theme';

export function wellColor(kind: CenterKind) {
  if (kind === 'transplante') return colors.primary100;
  if (kind === 'campanha') return colors.warning100;
  return colors.teal100;
}

export function iconColor(kind: CenterKind) {
  if (kind === 'transplante') return colors.primary600;
  if (kind === 'campanha') return colors.warning700;
  return colors.teal600;
}

export function kindIcon(kind: CenterKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'campanha') return 'megaphone-outline';
  return 'business-outline';
}
