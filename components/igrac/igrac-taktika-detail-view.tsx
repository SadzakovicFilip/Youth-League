import * as Clipboard from 'expo-clipboard';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { RefreshableScrollView } from '@/components/refreshable-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionAccentHex } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { unpackTacticDescription } from '@/lib/tactic-description-reference';
import { supabase } from '@/lib/supabase';

type Kind = 'attack' | 'defense';

type Detail = {
  tactic: {
    id: number;
    club_id: number;
    name: string;
    kind: Kind;
    description: string | null;
    is_active: boolean;
    updated_at: string;
  };
  can_manage: boolean;
  actions: {
    id: number;
    name: string;
    description: string | null;
    position: number;
  }[];
};

function isYouTubeUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('youtube.com') || u.includes('youtu.be');
}

type Props = {
  tacticId: number;
};

export function IgracTaktikaDetailView({ tacticId }: Props) {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data: res, error } = await supabase.rpc('get_tactic_detail', {
      p_tactic_id: tacticId,
    });
    if (error) {
      setErrorMessage(error.message);
      setDetail(null);
      setLoading(false);
      return;
    }
    setDetail(res as Detail);
    setLoading(false);
  }, [tacticId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useScreenPullRefresh(load);

  const tactic = detail?.tactic;
  const actions = detail?.actions ?? [];
  const unpacked = unpackTacticDescription(tactic?.description);
  const referenceUrl = unpacked.referenceUrl.trim();

  const copyReference = async () => {
    if (!referenceUrl) return;
    await Clipboard.setStringAsync(referenceUrl);
  };

  const openReference = () => {
    if (!referenceUrl) return;
    const withProto = /^https?:\/\//i.test(referenceUrl)
      ? referenceUrl
      : `https://${referenceUrl.replace(/^\/+/, '')}`;
    void Linking.openURL(withProto);
  };

  return (
    <RefreshableScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator color={colors.tint} /> : null}

      {errorMessage ? (
        <ThemedView style={[styles.errorCard, { borderColor: colors.danger }]}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {tactic ? (
        <>
          <View style={styles.titleRow}>
            <ThemedText type="title" style={{ flex: 1, color: colors.text }}>
              {tactic.name}
            </ThemedText>
            <ThemedText
              style={[
                styles.kindBadge,
                tactic.kind === 'attack' ? styles.kindAttack : styles.kindDefense,
              ]}>
              {tactic.kind === 'attack' ? 'Napad' : 'Odbrana'}
            </ThemedText>
          </View>

          {unpacked.body.trim() ? (
            <ThemedView style={[styles.card, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                Opis
              </ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>{unpacked.body.trim()}</ThemedText>
            </ThemedView>
          ) : null}

          {referenceUrl ? (
            <ThemedView style={[styles.card, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                Referenca
              </ThemedText>
              <ThemedText style={{ color: colors.textSecondary }} numberOfLines={2}>
                {referenceUrl}
              </ThemedText>
              <View style={styles.refActions}>
                <Pressable
                  style={[styles.refBtn, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted }]}
                  onPress={() => void copyReference()}>
                  <MaterialIcons name="content-copy" size={18} color={colors.tint} />
                  <ThemedText style={{ color: colors.tint, fontWeight: '700' }}>Kopiraj</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.refBtn, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted }]}
                  onPress={openReference}>
                  <MaterialIcons
                    name={isYouTubeUrl(referenceUrl) ? 'play-circle-outline' : 'open-in-new'}
                    size={20}
                    color={colors.tint}
                  />
                  <ThemedText style={{ color: colors.tint, fontWeight: '700' }}>Otvori</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          ) : null}

          <ThemedText type="subtitle" style={{ color: colors.text }}>
            Akcije ({actions.length})
          </ThemedText>

          {actions.length === 0 ? (
            <ThemedText style={{ color: colors.textSecondary }}>Nema akcija.</ThemedText>
          ) : (
            actions.map((a) => (
              <ThemedView
                key={a.id}
                style={[styles.actionCard, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted }]}>
                <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                  {a.position}. {a.name}
                </ThemedText>
                {a.description ? (
                  <ThemedText style={{ color: colors.textSecondary }}>{a.description}</ThemedText>
                ) : null}
              </ThemedView>
            ))
          )}
        </>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 28 },
  errorCard: { borderWidth: 1, borderRadius: 10, padding: 12 },
  errorText: { color: '#c53939', fontWeight: '600' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  kindBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
  },
  kindAttack: { backgroundColor: ActionAccentHex, color: '#fff' },
  kindDefense: { backgroundColor: '#c53939', color: '#fff' },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  refActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  refBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
});
