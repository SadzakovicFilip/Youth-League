import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import { supabase } from '@/lib/supabase';

export type DelegatMatchObjection = {
  id: number;
  club_id: number;
  club_name: string | null;
  reason: string;
  created_at: string;
  created_by: string;
  submitter_display: string | null;
  status: 'pending' | 'accepted' | 'rejected' | string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolver_display: string | null;
};

type ObjectionPhase = 'none' | 'pending' | 'resolved';

const GREEN = '#2a9d4a';
const YELLOW = '#c9a227';
const RED = '#c53939';

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('sr-Latn', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function statusLabel(status: string) {
  if (status === 'pending') return 'NA ČEKANJU';
  if (status === 'accepted') return 'USVOJEN';
  if (status === 'rejected') return 'ODBIJEN';
  return String(status).toUpperCase();
}

function phaseFromObjections(list: DelegatMatchObjection[]): ObjectionPhase {
  if (list.length === 0) return 'none';
  if (list.some((o) => o.status === 'pending')) return 'pending';
  return 'resolved';
}

type Props = {
  matchId: number;
  onObjectionResolved?: () => void;
};

export function DelegatMatchObjectionBoxScorePanel({ matchId, onObjectionResolved }: Props) {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [objections, setObjections] = useState<DelegatMatchObjection[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(matchId)) return;
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.rpc('get_delegat_match_detail', { p_match_id: matchId });
    if (error) {
      setErrorMessage(error.message);
      setObjections([]);
      setLoading(false);
      return;
    }
    const payload = data as { objections?: DelegatMatchObjection[] };
    setObjections(payload.objections ?? []);
    setLoading(false);
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const phase = phaseFromObjections(objections);
  const pendingList = useMemo(() => objections.filter((o) => o.status === 'pending'), [objections]);
  const resolvedList = useMemo(
    () => objections.filter((o) => o.status !== 'pending'),
    [objections],
  );

  const resolveObjection = async (objectionId: number, resolution: 'accepted' | 'rejected') => {
    setBusyId(objectionId);
    setErrorMessage('');
    const { error } = await supabase.rpc('resolve_match_objection', {
      p_objection_id: objectionId,
      p_resolution: resolution,
    });
    setBusyId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
    onObjectionResolved?.();
    if (pendingList.length <= 1) {
      setResolveOpen(false);
    }
  };

  const cardTheme = useMemo(() => {
    switch (phase) {
      case 'pending':
        return {
          border: RED,
          bg: `${RED}14`,
          text: RED,
          label: 'Reši prigovor',
          pressable: true,
        };
      case 'resolved':
        return {
          border: YELLOW,
          bg: `${YELLOW}18`,
          text: '#8a6914',
          label: 'Prigovor je rešen',
          pressable: true,
        };
      default:
        return {
          border: GREEN,
          bg: `${GREEN}14`,
          text: GREEN,
          label: 'Prigovora nije bilo',
          pressable: false,
        };
    }
  }, [phase]);

  const onCardPress = () => {
    if (phase === 'pending') setResolveOpen(true);
    else if (phase === 'resolved') setDetailOpen(true);
  };

  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.wrap}>
        {errorMessage ? (
          <ThemedText style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</ThemedText>
        ) : null}
        <Pressable
          onPress={cardTheme.pressable ? onCardPress : undefined}
          disabled={!cardTheme.pressable}
          style={({ pressed }) => [
            styles.card,
            {
              borderColor: cardTheme.border,
              backgroundColor: cardTheme.bg,
              opacity: cardTheme.pressable && pressed ? 0.92 : 1,
            },
          ]}
          accessibilityRole={cardTheme.pressable ? 'button' : 'text'}
          accessibilityLabel={cardTheme.label}>
          <View style={styles.cardRow}>
            <MaterialIcons
              name={
                phase === 'pending'
                  ? 'error-outline'
                  : phase === 'resolved'
                    ? 'info-outline'
                    : 'check-circle-outline'
              }
              size={20}
              color={cardTheme.text}
            />
            <ThemedText type="defaultSemiBold" style={[styles.cardLabel, { color: cardTheme.text }]}>
              {cardTheme.label}
            </ThemedText>
            {cardTheme.pressable ? (
              <MaterialIcons name="chevron-right" size={22} color={cardTheme.text} />
            ) : null}
          </View>
        </Pressable>
      </View>

      <ObjectionModal
        visible={detailOpen}
        title="Detalji prigovora"
        onClose={() => setDetailOpen(false)}
        colors={colors}>
        {resolvedList.length === 0 ? (
          <ThemedText style={{ color: colors.textSecondary }}>Nema podataka.</ThemedText>
        ) : (
          resolvedList.map((o) => (
            <ObjectionDetailBlock key={o.id} objection={o} colors={colors} showResolution />
          ))
        )}
      </ObjectionModal>

      <ObjectionModal
        visible={resolveOpen}
        title="Rešavanje prigovora"
        onClose={() => !busyId && setResolveOpen(false)}
        colors={colors}>
        {pendingList.length === 0 ? (
          <ThemedText style={{ color: colors.textSecondary }}>Nema prigovora na čekanju.</ThemedText>
        ) : (
          pendingList.map((o) => (
            <ThemedView
              key={o.id}
              style={[styles.modalBlock, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
              <ObjectionDetailBlock objection={o} colors={colors} showResolution={false} />
              {busyId === o.id ? (
                <ActivityIndicator color={colors.tint} style={{ marginTop: 10 }} />
              ) : (
                <View style={styles.btnRow}>
                  <Pressable
                    style={[styles.acceptBtn, busyId != null && styles.btnDisabled]}
                    onPress={() => resolveObjection(o.id, 'accepted')}
                    disabled={busyId != null}>
                    <ThemedText style={styles.btnText}>USVOJI</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.rejectBtn, busyId != null && styles.btnDisabled]}
                    onPress={() => resolveObjection(o.id, 'rejected')}
                    disabled={busyId != null}>
                    <ThemedText style={styles.btnText}>ODBIJ</ThemedText>
                  </Pressable>
                </View>
              )}
            </ThemedView>
          ))
        )}
      </ObjectionModal>
    </>
  );
}

function ObjectionDetailBlock({
  objection: o,
  colors,
  showResolution,
}: {
  objection: DelegatMatchObjection;
  colors: ReturnType<typeof useAppTheme>['colors'];
  showResolution: boolean;
}) {
  return (
    <View style={styles.detailBlock}>
      <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
        {o.club_name ?? `Klub #${o.club_id}`}
      </ThemedText>
      <ThemedText style={[styles.metaLine, { color: colors.textSecondary }]}>
        Podneo: {o.submitter_display ?? '—'} · {formatWhen(o.created_at)}
      </ThemedText>
      <ThemedText style={[styles.reason, { color: colors.text }]}>{o.reason}</ThemedText>
      {showResolution ? (
        <>
          <ThemedText
            style={[
              styles.statusLine,
              o.status === 'accepted' && { color: GREEN },
              o.status === 'rejected' && { color: RED },
              o.status === 'pending' && { color: YELLOW },
            ]}>
            Status: {statusLabel(o.status)}
          </ThemedText>
          {o.resolved_at ? (
            <ThemedText style={[styles.metaLine, { color: colors.textSecondary }]}>
              Odluka: {formatWhen(o.resolved_at)}
              {o.resolver_display ? ` · ${o.resolver_display}` : ''}
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function ObjectionModal({
  visible,
  title,
  onClose,
  colors,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
          onPress={(e) => e.stopPropagation()}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText type="subtitle" style={{ color: colors.text, flex: 1 }}>
              {title}
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Zatvori">
              <MaterialIcons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalBody}
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 4 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardLabel: { flex: 1, fontSize: 15 },
  errorText: { fontSize: 12, marginBottom: 6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalBody: { padding: 16, gap: 12, paddingBottom: 32 },
  modalBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  detailBlock: { gap: 6 },
  metaLine: { fontSize: 13 },
  reason: { marginTop: 2, lineHeight: 20 },
  statusLine: { fontWeight: '700', marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  acceptBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: RED,
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
