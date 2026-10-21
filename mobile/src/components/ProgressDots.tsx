import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

type Props = {
  count: number;
  index: number;
  onChange?: (index: number) => void;
};

export function ProgressDots({ count, index, onChange }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Pressable
          key={i}
          accessibilityRole="button"
          accessibilityLabel={i === 0 ? 'Doador' : 'Receptor'}
          accessibilityState={{ selected: i === index }}
          disabled={!onChange}
          hitSlop={8}
          onPress={() => onChange?.(i)}
        >
          <View style={[styles.dot, i === index ? styles.active : styles.idle]} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  active: { width: 22, backgroundColor: colors.primary },
  idle: { width: 6, backgroundColor: '#D4DCEC' },
});
