import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';

type Props = {
  loading: boolean;
  errorMessage: string;
};

export function IgracScreenState({ loading, errorMessage }: Props) {
  const { colors } = useAppTheme();

  if (loading) {
    return (
      <ThemedView style={[styles.card, { borderColor: colors.borderStrong }]}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (errorMessage) {
    return (
      <ThemedView style={[styles.errorCard, { borderColor: colors.danger }]}>
        <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
      </ThemedView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: '#c53939' },
});
