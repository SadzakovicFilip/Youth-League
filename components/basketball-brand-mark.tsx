import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = { sm: 36, md: 56, lg: 72 };

/**
 * Diskretan vizuelni znak (lopta + blagi „panel“) — ne guši UI.
 */
export function BasketballBrandMark({ size = 'md' }: Props) {
  const scheme = useColorScheme();
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'border');
  const dim = SIZES[size];
  const ballBg = scheme === 'dark' ? '#2A241F' : '#FFF5EE';

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Kosarka">
      <View style={[styles.ring, { width: dim + 20, height: dim + 20, borderColor: border }]}>
        <View style={[styles.ballPlate, { width: dim, height: dim, backgroundColor: ballBg }]}>
          <Ionicons name="basketball" size={dim * 0.72} color={accent} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballPlate: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
