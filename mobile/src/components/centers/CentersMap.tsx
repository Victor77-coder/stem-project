import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { CenterResult, Origin } from '@/content/centers';
import { colors } from '@/theme';
import { iconColor, kindIcon, wellColor } from './kind';

export type CentersMapProps = {
  origin: Origin;
  results: CenterResult[];
  onOpen: (id: string) => void;
  /** Altura fixa: mapa de destaque no detalhe, estático e centrado em `focus`. Sem altura, ocupa a tela. */
  height?: number;
  focus?: { lat: number; lng: number };
};

const MIN_DELTA = 0.04;
const NEAREST_IN_VIEW = 4;

function regionFor(origin: Origin, results: CenterResult[], focus?: { lat: number; lng: number }): Region {
  if (focus) return { latitude: focus.lat, longitude: focus.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
  const points = [origin, ...results.slice(0, NEAREST_IN_VIEW)];
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(MIN_DELTA, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(MIN_DELTA, (maxLng - minLng) * 1.6),
  };
}

export function CentersMap({ origin, results, onOpen, height, focus }: CentersMapProps) {
  const ref = useRef<MapView>(null);
  const region = useMemo(() => regionFor(origin, results, focus), [origin, results, focus]);
  const ids = results.map((item) => item.id).join(',');

  useEffect(() => {
    ref.current?.animateToRegion(region, 350);
    // Recentraliza quando a origem ou o conjunto de unidades muda, não a cada novo objeto de região.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng, focus?.lat, focus?.lng, ids]);

  const compact = height !== undefined;

  return (
    <MapView
      ref={ref}
      style={compact ? { height } : styles.fill}
      initialRegion={region}
      showsUserLocation={origin.mode === 'gps'}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      scrollEnabled={!compact}
      zoomEnabled={!compact}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      {origin.mode === 'cep' ? (
        <Marker coordinate={{ latitude: origin.lat, longitude: origin.lng }} title={origin.label} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.originDot} />
        </Marker>
      ) : null}
      {results.map((center) => (
        <Marker
          key={center.id}
          coordinate={{ latitude: center.lat, longitude: center.lng }}
          accessibilityLabel={center.shortName}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => onOpen(center.id)}
        >
          <View style={[styles.pin, { backgroundColor: wellColor(center.kind) }]}>
            <Ionicons name={kindIcon(center.kind)} size={14} color={iconColor(center.kind)} />
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  originDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary600,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
