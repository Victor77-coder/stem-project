import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CenterResult, Origin } from '@/content/centers';
import { colors } from '@/theme';
import { iconColor, kindIcon, wellColor } from './kind';
import type { CentersMapProps } from './CentersMap';

/** react-native-maps não roda na web; aqui fica o mapa ilustrativo, com pinos projetados a partir da origem. */
export function CentersMap({ origin, results, onOpen, height }: CentersMapProps) {
  return (
    <View style={[styles.map, height ? { height, flexGrow: 0, flexShrink: 0 } : styles.mapFill]}>
      <View style={[styles.block, { top: 48, left: 24, width: 90, height: 70 }]} />
      <View style={[styles.block, { top: 40, right: 36, width: 80, height: 80, backgroundColor: colors.teal100 }]} />
      <View style={[styles.block, { top: 160, left: 70, width: 110, height: 64 }]} />
      <View style={[styles.block, { top: 210, right: 20, width: 96, height: 72, backgroundColor: '#DCE8F8' }]} />
      <View style={[styles.streetH, { top: 128 }]} />
      <View style={[styles.streetH, { top: 250 }]} />
      <View style={[styles.streetV, { left: '38%' }]} />
      <View style={[styles.streetV, { left: '68%' }]} />
      <View style={[styles.userDot, { top: '46%', left: '48%' }]} />
      {results.map((center) => {
        const pin = project(origin, center);
        return (
          <Pressable
            key={center.id}
            accessibilityRole="button"
            accessibilityLabel={center.shortName}
            onPress={() => onOpen(center.id)}
            style={[styles.pin, { top: pin.top, left: pin.left, backgroundColor: wellColor(center.kind) }]}
          >
            <Ionicons name={kindIcon(center.kind)} size={12} color={iconColor(center.kind)} />
          </Pressable>
        );
      })}
    </View>
  );
}

function project(origin: Origin, center: Pick<CenterResult, 'lat' | 'lng'>) {
  const x = 48 + (center.lng - origin.lng) * 420;
  const y = 46 - (center.lat - origin.lat) * 420;
  return {
    top: `${Math.min(82, Math.max(14, y))}%` as const,
    left: `${Math.min(84, Math.max(8, x))}%` as const,
  };
}

const styles = StyleSheet.create({
  map: { backgroundColor: '#E7EEF6', overflow: 'hidden' },
  mapFill: { flex: 1 },
  block: { position: 'absolute', borderRadius: 12, backgroundColor: '#F4F7FB' },
  streetH: { position: 'absolute', left: 0, right: 0, height: 10, backgroundColor: '#F8FBFE' },
  streetV: { position: 'absolute', top: 0, bottom: 0, width: 10, backgroundColor: '#F8FBFE' },
  userDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginLeft: -8,
    marginTop: -8,
    borderRadius: 8,
    backgroundColor: colors.primary600,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pin: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
