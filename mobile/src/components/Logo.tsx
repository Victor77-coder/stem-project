import { Image, StyleSheet } from 'react-native';

type Props = { size?: 'sm' | 'md' };

const SOURCE = require('../../assets/illustrations/logo.png');
const ASPECT = 325 / 130;

export function Logo({ size = 'md' }: Props) {
  const height = size === 'sm' ? 36 : 52;
  return (
    <Image
      source={SOURCE}
      accessibilityLabel="STEM Project"
      resizeMode="contain"
      style={[styles.logo, { height, width: height * ASPECT }]}
    />
  );
}

const styles = StyleSheet.create({
  logo: { alignSelf: 'center' },
});
