import * as Clipboard from 'expo-clipboard';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { RefreshableScrollView } from '@/components/refreshable-scroll-view';
import {
  SearchableSelect,
  type SelectOption,
} from '@/components/shared/searchable-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import {
  packTacticDescription,
  unpackTacticDescription,
} from '@/lib/tactic-description-reference';
import { supabase } from '@/lib/supabase';

type Tactic = {
  id: number;
  name: string;
  kind: 'attack' | 'defense';
  description: string | null;
  is_active: boolean;
  actions_count: number;
  updated_at: string;
};

type Payload = {
  club_id: number;
  can_manage: boolean;
  tactics: Tactic[];
};

type Props = {
  embedded?: boolean;
};

type TacticKindFilter = 'attack' | 'defense';
type TacticKind = 'attack' | 'defense';

const KIND_OPTIONS: SelectOption[] = [
  { value: 'attack', label: 'Napad' },
  { value: 'defense', label: 'Odbrana' },
];

const CELEBRATION_GREEN = '#047857';

function isYouTubeUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('youtube.com') || u.includes('youtu.be');
}

export function TrenerTaktikeContent({ embedded = false }: Props) {
  const { colors } = useAppTheme();
  const [kindFilter, setKindFilter] = useState<TacticKindFilter>('attack');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [clubId, setClubId] = useState<number | null>(null);
  const [data, setData] = useState<Payload | null>(null);

  const [showTacticForm, setShowTacticForm] = useState(false);
  const [newKind, setNewKind] = useState<TacticKind | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newReferenceUrl, setNewReferenceUrl] = useState('');
  const [tacticSubmitting, setTacticSubmitting] = useState(false);
  const [saveTacticCelebration, setSaveTacticCelebration] = useState(false);
  const tacticSavePulse = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data: cid, error: cErr } = await supabase.rpc('my_trener_or_klub_club_id');
    if (cErr) {
      setErrorMessage(cErr.message);
      setLoading(false);
      return;
    }
    const resolved = typeof cid === 'number' ? cid : cid == null ? null : Number(cid);
    setClubId(resolved);
    if (!resolved) {
      setData(null);
      setLoading(false);
      return;
    }
    const { data: res, error } = await supabase.rpc('get_club_tactics', {
      p_club_id: resolved,
      p_kind: null,
    });
    if (error) {
      setErrorMessage(error.message);
      setData(null);
    } else {
      setData((res ?? null) as Payload | null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visibleTactics = useMemo(() => {
    return (data?.tactics ?? []).filter((t) => t.kind === kindFilter);
  }, [data, kindFilter]);

  useScreenPullRefresh(load);

  const resetNewTacticForm = useCallback(() => {
    setNewKind(null);
    setNewName('');
    setNewDescription('');
    setNewReferenceUrl('');
  }, []);

  const clearTacticCelebration = useCallback(() => {
    setSaveTacticCelebration(false);
  }, []);

  useEffect(() => {
    if (!saveTacticCelebration) {
      tacticSavePulse.setValue(0.88);
      return;
    }
    tacticSavePulse.setValue(0.78);
    Animated.timing(tacticSavePulse, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => {
      clearTacticCelebration();
      setShowTacticForm(false);
      resetNewTacticForm();
      void load();
    }, 3000);
    return () => clearTimeout(t);
  }, [saveTacticCelebration, clearTacticCelebration, tacticSavePulse, load, resetNewTacticForm]);

  const showNewDetailFields = newKind != null;

  const copyNewReference = async () => {
    const t = newReferenceUrl.trim();
    if (!t) return;
    await Clipboard.setStringAsync(t);
  };

  const openNewReference = () => {
    const t = newReferenceUrl.trim();
    if (!t) return;
    const withProto =
      /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
    void Linking.openURL(withProto);
  };

  const onSaveNewTactic = async () => {
    setErrorMessage('');
    if (!clubId) return;
    if (newKind == null) {
      setErrorMessage('Izaberi tip taktike.');
      return;
    }
    if (!newName.trim()) {
      setErrorMessage('Ime taktike je obavezno.');
      return;
    }
    const packed = packTacticDescription(newDescription, newReferenceUrl);
    setTacticSubmitting(true);
    const { error } = await supabase.rpc('upsert_tactic', {
      p_tactic_id: null,
      p_club_id: clubId,
      p_name: newName.trim(),
      p_kind: newKind,
      p_description: packed.trim() === '' ? null : packed,
      p_actions: [],
    });
    setTacticSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    void load();
    setSaveTacticCelebration(true);
  };

  const body = (
    <View style={embedded ? styles.embedded : styles.standalone}>
      {!embedded ? (
        <ThemedText type="title" style={[styles.standaloneTitle, { color: colors.text }]}>
          Taktike
        </ThemedText>
      ) : null}

      {data?.can_manage ? (
        <View style={[styles.addRow, embedded && styles.addRowEmbedded]}>
          <Pressable
            style={[
              styles.addButton,
              { borderColor: colors.tint, backgroundColor: colors.surface },
            ]}
            onPress={() => {
              setShowTacticForm((v) => {
                const next = !v;
                if (!next) resetNewTacticForm();
                return next;
              });
            }}>
            <ThemedText style={[styles.addButtonText, { color: colors.tint }]}>
              {showTacticForm ? 'Zatvori' : '+ Dodaj taktiku'}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {data?.can_manage && showTacticForm ? (
        <ThemedView
          style={[
            styles.formCard,
            { borderColor: colors.borderStrong, backgroundColor: colors.surface },
          ]}>
          <ThemedText type="defaultSemiBold" style={{ color: colors.text, textAlign: 'center' }}>
            Nova taktika
          </ThemedText>
          <ThemedText
            type="defaultSemiBold"
            style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Tip taktike
          </ThemedText>
          <SearchableSelect
            placeholder="Izaberi tip…"
            sheetTitle="Tip taktike"
            value={newKind}
            options={KIND_OPTIONS}
            clearable={false}
            onChange={(v) => setNewKind((v as TacticKind) ?? null)}
            containerStyle={styles.selectBlock}
          />

          {showNewDetailFields ? (
            <>
              <ThemedTextInput
                value={newName}
                onChangeText={setNewName}
                placeholder={
                  newKind === 'defense' ? 'Ime odbrane' : 'Ime napada / taktike'
                }
                style={styles.inputSpacing}
              />
              <ThemedText
                type="defaultSemiBold"
                style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Link referenca (opciono)
              </ThemedText>
              <ThemedTextInput
                value={newReferenceUrl}
                onChangeText={setNewReferenceUrl}
                placeholder="https://… ili YouTube link"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.inputSpacing}
              />
              {newReferenceUrl.trim() ? (
                <View style={styles.refActions}>
                  <Pressable
                    style={[
                      styles.refBtn,
                      {
                        borderColor: colors.borderStrong,
                        backgroundColor: colors.surfaceMuted,
                      },
                    ]}
                    onPress={() => void copyNewReference()}>
                    <MaterialIcons name="content-copy" size={18} color={colors.tint} />
                    <ThemedText style={[styles.refBtnText, { color: colors.tint }]}>
                      Kopiraj link
                    </ThemedText>
                  </Pressable>
                  {isYouTubeUrl(newReferenceUrl) ? (
                    <Pressable
                      style={[
                        styles.refBtn,
                        {
                          borderColor: colors.borderStrong,
                          backgroundColor: colors.surfaceMuted,
                        },
                      ]}
                      onPress={openNewReference}>
                      <MaterialIcons name="play-circle-outline" size={20} color={colors.tint} />
                      <ThemedText style={[styles.refBtnText, { color: colors.tint }]}>
                        Otvori (YouTube)
                      </ThemedText>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[
                        styles.refBtn,
                        {
                          borderColor: colors.borderStrong,
                          backgroundColor: colors.surfaceMuted,
                        },
                      ]}
                      onPress={openNewReference}>
                      <MaterialIcons name="open-in-new" size={18} color={colors.tint} />
                      <ThemedText style={[styles.refBtnText, { color: colors.tint }]}>
                        Otvori link
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              ) : null}
              <ThemedTextInput
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Opis (opciono)"
                style={[styles.inputSpacing, styles.inputMulti]}
                multiline
              />
            </>
          ) : null}

          <Pressable
            style={[
              styles.saveButton,
              {
                backgroundColor: saveTacticCelebration ? CELEBRATION_GREEN : colors.tint,
              },
              saveTacticCelebration && styles.saveCelebrationPad,
              (tacticSubmitting || saveTacticCelebration) && styles.buttonDisabled,
            ]}
            onPress={() => void onSaveNewTactic()}
            disabled={tacticSubmitting || saveTacticCelebration}>
            {tacticSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : saveTacticCelebration ? (
              <View style={styles.celebrationRow}>
                <Animated.View style={{ transform: [{ scale: tacticSavePulse }] }}>
                  <MaterialIcons
                    name="check-circle"
                    size={26}
                    color="#FFFFFF"
                    accessibilityLabel="Taktika sačuvana"
                  />
                </Animated.View>
                <ThemedText
                  lightColor="#FFFFFF"
                  darkColor="#FFFFFF"
                  style={styles.celebrationText}>
                  Taktika sačuvana
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.saveButtonText}>Sačuvaj taktiku</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      ) : null}

      {data ? (
        <View style={styles.filterChipRow}>
          <Pressable
            style={[
              styles.filterChip,
              {
                backgroundColor: kindFilter === 'attack' ? colors.tint : colors.surfaceMuted,
                borderColor: kindFilter === 'attack' ? colors.tint : colors.borderStrong,
              },
            ]}
            onPress={() => setKindFilter('attack')}>
            <ThemedText
              type="defaultSemiBold"
              numberOfLines={1}
              style={{
                color: kindFilter === 'attack' ? '#fff' : colors.text,
                fontSize: 11,
                letterSpacing: 0.15,
                textAlign: 'center',
              }}>
              Napad
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.filterChip,
              {
                backgroundColor: kindFilter === 'defense' ? colors.tint : colors.surfaceMuted,
                borderColor: kindFilter === 'defense' ? colors.tint : colors.borderStrong,
              },
            ]}
            onPress={() => setKindFilter('defense')}>
            <ThemedText
              type="defaultSemiBold"
              numberOfLines={1}
              style={{
                color: kindFilter === 'defense' ? '#fff' : colors.text,
                fontSize: 11,
                letterSpacing: 0.15,
                textAlign: 'center',
              }}>
              Odbrana
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {loading ? <ActivityIndicator color={colors.tint} /> : null}
      {errorMessage ? (
        <ThemedView
          style={[
            styles.errorCard,
            { borderColor: colors.danger, backgroundColor: colors.surface },
          ]}>
          <ThemedText style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}
      {!loading && !clubId ? (
        <ThemedView
          style={[
            styles.card,
            { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
          ]}>
          <ThemedText style={{ color: colors.text }}>Nisi dodeljen klubu.</ThemedText>
        </ThemedView>
      ) : null}

      {data ? (
        <>
          {visibleTactics.length === 0 ? (
            <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>
              Nema taktika u ovoj kategoriji.
            </ThemedText>
          ) : null}
          {visibleTactics.map((t) => (
            <TacticRow key={t.id} tactic={t} />
          ))}
        </>
      ) : null}
    </View>
  );

  if (embedded) return body;
  return (
    <RefreshableScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      {body}
    </RefreshableScrollView>
  );
}

function TacticRow({ tactic }: { tactic: Tactic }) {
  const { colors } = useAppTheme();
  const descPreview = unpackTacticDescription(tactic.description).body.trim();
  const n = tactic.actions_count;
  const actionsHint =
    n === 1 ? '1 akcija' : n >= 2 && n <= 4 ? `${n} akcije` : `${n} akcija`;
  return (
    <Pressable
      style={[
        styles.tacticCard,
        { borderColor: colors.borderStrong, backgroundColor: colors.surface },
      ]}
      onPress={() => router.push(`/trener/taktika/${tactic.id}` as never)}>
      <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
        {tactic.name}
      </ThemedText>
      {descPreview ? (
        <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>{descPreview}</ThemedText>
      ) : null}
      {n > 0 ? (
        <ThemedText style={[styles.hint, { color: colors.tint }]}>{actionsHint} ▸</ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  embedded: { gap: 12 },
  standalone: { gap: 12 },
  standaloneTitle: { textAlign: 'center', marginBottom: 4 },
  addRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 4,
  },
  addRowEmbedded: { marginTop: 0 },
  addButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  addButtonText: { fontWeight: '700', fontSize: 15 },
  formCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  fieldLabel: { marginTop: 4, fontSize: 13 },
  selectBlock: { alignSelf: 'stretch' },
  inputSpacing: { marginTop: 6 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  refActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  refBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  refBtnText: { fontWeight: '700', fontSize: 13 },
  saveButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCelebrationPad: { paddingHorizontal: 12 },
  celebrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  celebrationText: { fontWeight: '700', fontSize: 15 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  filterChipRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { fontWeight: '600' },
  tacticCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  hint: { fontWeight: '700', marginTop: 2 },
  muted: { fontStyle: 'italic', fontSize: 14, lineHeight: 20 },
});
