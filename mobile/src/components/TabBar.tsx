import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

export const TABS = [
  { id: 'inicio', label: 'Início', icon: 'home' },
  { id: 'aprender', label: 'Aprender', icon: 'book-outline' },
  { id: 'jornada', label: 'Jornada', icon: 'git-branch-outline' },
  { id: 'centros', label: 'Centros', icon: 'location-outline' },
  { id: 'perfil', label: 'Perfil', icon: 'person-outline' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

type Props = {
  value: TabId;
  onChange: (id: TabId) => void;
};

export function TabBar({ value, onChange }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const active = tab.id === value;
        const color = active ? colors.primary600 : colors.textTertiary;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.id)}
            style={styles.item}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Ionicons name={tab.icon} size={22} color={color} />
            </View>
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap: {
    minWidth: 56,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.primary100 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
