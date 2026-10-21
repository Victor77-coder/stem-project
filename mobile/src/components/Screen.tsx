import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '@/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
};

export function Screen({ children, scroll = true, footer }: Props) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1 }]}>{children}</View>
  );

  return (
    <View style={styles.shell}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#EEF1F6' },
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
  },
  content: {
    paddingHorizontal: space.screenX,
    paddingTop: 12,
    paddingBottom: 24,
    gap: space.gap,
  },
  footer: {
    paddingHorizontal: space.screenX,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: colors.bg,
  },
});
