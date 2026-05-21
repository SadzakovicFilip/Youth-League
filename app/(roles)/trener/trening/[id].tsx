import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import type { MatchRichTheme } from '@/components/shared/match-rich-card';
import { TrainingRichCard } from '@/components/trener/training-rich-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

const CELEBRATION_GREEN = '#047857';

type Player = {
  player_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  present: boolean;
};

type Payload = {
  training: {
    id: number;
    club_id: number;
    scheduled_at: string;
    topic: string;
    venue: string | null;
    note: string | null;
  } | null;
  can_manage: boolean;
  players: Player[];
};

function playerName(p: Player) {
  return (
    p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || '—'
  );
}

export default function TrenerTreningDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trainingId = Number(id);
  const { colors } = useAppTheme();

  const matchRichTheme = useMemo<MatchRichTheme>(
    () => ({
      surfaceMuted: colors.surfaceMuted,
      borderStrong: colors.borderStrong,
      tint: colors.tint,
      text: colors.text,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      danger: colors.danger,
    }),
    [colors],
  );

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveCelebration, setSaveCelebration] = useState(false);
  const saveSuccessPulse = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    if (!Number.isFinite(trainingId)) {
      setErrorMessage('Neispravan ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const { data: res, error } = await supabase.rpc('get_training_detail', {
      p_training_id: trainingId,
    });
    if (error) {
      setErrorMessage(error.message);
      setData(null);
      setLoading(false);
      return;
    }
    const payload = (res ?? null) as Payload | null;
    setData(payload);
    setSelected(new Set((payload?.players ?? []).filter((p) => p.present).map((p) => p.player_id)));
    setLoading(false);
  }, [trainingId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useScreenPullRefresh(load);

  const clearSaveCelebration = useCallback(() => {
    setSaveCelebration(false);
  }, []);

  useEffect(() => {
    if (!saveCelebration) {
      saveSuccessPulse.setValue(0.88);
      return;
    }
    saveSuccessPulse.setValue(0.78);
    Animated.timing(saveSuccessPulse, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => clearSaveCelebration(), 3000);
    return () => clearTimeout(t);
  }, [saveCelebration, clearSaveCelebration, saveSuccessPulse]);

  const toggle = (pid: string) => {
    if (!data?.can_manage) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const onSave = async () => {
    if (!data?.training) return;
    setSaving(true);
    setErrorMessage('');
    const entries = (data.players ?? []).map((p) => ({
      player_id: p.player_id,
      present: selected.has(p.player_id),
    }));
    const { error } = await supabase.rpc('set_training_attendance', {
      p_training_id: trainingId,
      p_entries: entries,
    });
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
    setSaveCelebration(true);
  };

  const presentCount = useMemo(() => selected.size, [selected]);
  const totalPlayers = data?.players.length ?? 0;

  return (
    <RefreshableScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
    >
      {loading ? <ActivityIndicator color={colors.tint} /> : null}

      {errorMessage ? (
        <ThemedView
          style={[
            styles.errorCard,
            { borderColor: colors.danger, backgroundColor: colors.surface },
          ]}
        >
          <ThemedText style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {data?.training ? (
        <TrainingRichCard
          theme={matchRichTheme}
          topic={data.training.topic}
          scheduledIso={data.training.scheduled_at}
          venue={data.training.venue}
          note={data.training.note}
          playersPresent={presentCount}
          playersTotal={totalPlayers}
        />
      ) : null}

      <ThemedView style={styles.sectionHead}>
        <MaterialIcons name="how-to-reg" size={22} color={colors.tint} />
        <ThemedText type="subtitle" style={{ color: colors.text }}>
          Prisustvo ({presentCount}/{totalPlayers})
        </ThemedText>
      </ThemedView>
      {data?.can_manage ? (
        <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
          Dodirni igrača da označiš / skineš prisustvo, zatim sačuvaj.
        </ThemedText>
      ) : (
        <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
          Samo trener ili klub mogu da beleže prisustvo.
        </ThemedText>
      )}

      {data?.players.length === 0 ? (
        <ThemedView
          style={[
            styles.emptyCard,
            { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
          ]}
        >
          <ThemedText style={{ color: colors.text }}>Nema igrača u klubu.</ThemedText>
        </ThemedView>
      ) : null}

      {data?.players.map((p) => {
        const isSel = selected.has(p.player_id);
        return (
          <Pressable
            key={p.player_id}
            onPress={() => toggle(p.player_id)}
            disabled={!data?.can_manage}
            style={[
              styles.playerRow,
              {
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
              },
              isSel && {
                borderColor: colors.tint,
                backgroundColor: colors.accentMuted,
              },
            ]}
          >
            <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
              {playerName(p)}
            </ThemedText>
            <ThemedText
              style={[
                styles.badge,
                isSel
                  ? { backgroundColor: colors.tint, color: '#fff' }
                  : { backgroundColor: colors.surfaceMuted, color: colors.textSecondary },
              ]}
            >
              {isSel ? 'Prisutan' : 'Nije'}
            </ThemedText>
          </Pressable>
        );
      })}

      {data?.can_manage ? (
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: saveCelebration ? CELEBRATION_GREEN : colors.tint },
            saveCelebration && styles.saveBtnCelebration,
            saving && styles.buttonDisabled,
          ]}
          onPress={onSave}
          disabled={saving || saveCelebration}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : saveCelebration ? (
            <View style={styles.saveCelebrationRow}>
              <Animated.View style={{ transform: [{ scale: saveSuccessPulse }] }}>
                <MaterialIcons name="check-circle" size={28} color="#FFFFFF" accessibilityLabel="Sačuvano" />
              </Animated.View>
              <ThemedText
                lightColor="#FFFFFF"
                darkColor="#FFFFFF"
                style={styles.saveCelebrationText}
              >
                Prisustvo sačuvano
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.primaryButtonText}>Sačuvaj prisustvo</ThemedText>
          )}
        </Pressable>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 28 },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { fontWeight: '600' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  hint: { fontSize: 14, lineHeight: 20 },
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    overflow: 'hidden',
    fontWeight: '800',
  },
  primaryButton: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnCelebration: { paddingHorizontal: 14 },
  saveCelebrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveCelebrationText: { fontWeight: '700', fontSize: 15 },
  primaryButtonText: { color: '#fff', fontWeight: '800', letterSpacing: 0.3 },
  buttonDisabled: { opacity: 0.6 },
});
