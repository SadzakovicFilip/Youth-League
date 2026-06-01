import { router } from 'expo-router';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useIgracDashboard } from '@/contexts/igrac-dashboard-context';
import type { IgracTacticRow } from '@/lib/igrac-dashboard-types';
import { unpackTacticDescription } from '@/lib/tactic-description-reference';

import { IgracScreenState } from './igrac-screen-state';

type Props = {
  embedded?: boolean;
};

type KindFilter = 'attack' | 'defense';

function tacticCountLabel(n: number): string {
  if (n === 1) return '1 taktika';
  if (n >= 2 && n <= 4) return `${n} taktike`;
  return `${n} taktika`;
}

function TacticListRow({ tactic }: { tactic: IgracTacticRow }) {
  const { colors } = useAppTheme();
  const descPreview = unpackTacticDescription(tactic.description).body.trim();
  const n = tactic.actions.length;
  const actionsHint =
    n === 0 ? null : n === 1 ? '1 akcija' : n >= 2 && n <= 4 ? `${n} akcije` : `${n} akcija`;

  return (
    <Pressable
      style={[styles.listCard, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
      onPress={() => router.push(`/igrac/taktika/${tactic.id}` as never)}>
      <ThemedText type="defaultSemiBold" style={{ color: colors.text }} numberOfLines={2}>
        {tactic.name}
      </ThemedText>
      {descPreview ? (
        <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>
          {descPreview}
        </ThemedText>
      ) : null}
      {actionsHint ? (
        <ThemedText style={{ color: colors.tint, fontWeight: '700', fontSize: 12 }}>{actionsHint} ▸</ThemedText>
      ) : (
        <ThemedText style={{ color: colors.tint, fontWeight: '700', fontSize: 12 }}>Otvori ▸</ThemedText>
      )}
    </Pressable>
  );
}

export function IgracTaktikeContent({ embedded = false }: Props) {
  const { colors } = useAppTheme();
  const { loading, errorMessage, data } = useIgracDashboard();
  const [kindFilter, setKindFilter] = useState<KindFilter>('attack');
  const allTactics = data?.tactics ?? [];

  const counts = useMemo(
    () => ({
      attack: allTactics.filter((t) => t.kind === 'attack').length,
      defense: allTactics.filter((t) => t.kind === 'defense').length,
    }),
    [allTactics],
  );

  const tactics = allTactics.filter((t) => t.kind === kindFilter);
  const kindLabel = kindFilter === 'attack' ? 'Napad' : 'Odbrana';

  return (
    <>
      {!embedded ? (
        <ThemedText type="subtitle" style={{ color: colors.text }}>
          Taktike kluba
        </ThemedText>
      ) : null}

      <View style={styles.filterRow}>
        {(['attack', 'defense'] as const).map((k) => {
          const active = kindFilter === k;
          const count = k === 'attack' ? counts.attack : counts.defense;
          const label = k === 'attack' ? `Napad (${count})` : `Odbrana (${count})`;
          return (
            <Pressable
              key={k}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.tint : colors.surfaceMuted,
                  borderColor: active ? colors.tint : colors.borderStrong,
                },
              ]}
              onPress={() => setKindFilter(k)}>
              <ThemedText
                type="defaultSemiBold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                  color: active ? '#fff' : colors.text,
                  fontSize: 11,
                  letterSpacing: 0.15,
                  textAlign: 'center',
                }}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {!loading && !errorMessage ? (
        <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
          {kindLabel}: {tacticCountLabel(tactics.length)}
        </ThemedText>
      ) : null}

      <IgracScreenState loading={loading} errorMessage={errorMessage} />

      {!loading && !errorMessage ? (
        tactics.length === 0 ? (
          <ThemedView style={[styles.empty, { borderColor: colors.borderStrong }]}>
            <ThemedText style={{ color: colors.textSecondary }}>
              Nema aktivnih taktika za {kindFilter === 'attack' ? 'napad' : 'odbranu'}.
            </ThemedText>
          </ThemedView>
        ) : (
          tactics.map((t) => <TacticListRow key={t.id} tactic={t} />)
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    minHeight: 38,
    justifyContent: 'center',
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
});
