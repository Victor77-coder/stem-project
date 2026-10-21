import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';

type Props = {
  onLeft: () => void;
  onRight: () => void;
  leftLabel?: string;
  rightLabel?: string;
  rightDisabled?: boolean;
};

export function NavPair({
  onLeft,
  onRight,
  leftLabel = 'Voltar',
  rightLabel = 'Continuar',
  rightDisabled,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <Button label={leftLabel} variant="secondary" onPress={onLeft} />
      </View>
      <View style={styles.item}>
        <Button label={rightLabel} disabled={rightDisabled} onPress={onRight} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  item: { flex: 1 },
});
