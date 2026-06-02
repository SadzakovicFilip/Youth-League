import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAppTheme } from '@/contexts/app-theme-context';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { RefreshableScrollView } from '@/components/refreshable-scroll-view';
import { MatchTimetableCalendar } from '@/components/shared/match-timetable-calendar';
import { TrainingRichCard } from '@/components/trener/training-rich-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { buildTrainingRichTheme } from '@/lib/training-calendar-theme';
import { supabase } from '@/lib/supabase';

type Training = {
  id: number;
  scheduled_at: string;
  topic: string;
  venue: string | null;
  note: string | null;
  players_total: number;
  players_present: number;
};

type Payload = {
  club: { id: number; name: string } | null;
  can_manage: boolean;
  trainings: Training[];
};

type Props = {
  /** U tabu „Treninzi i taktike“ — bez sopstvenog scroll-a. */
  embedded?: boolean;
};

const CELEBRATION_GREEN = '#047857';

function defaultTrainingDate(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(0);
  d.setHours(d.getHours() + 1);
  return d;
}

export function TrenerTreninziContent({ embedded = false }: Props) {
  const { colors, colorScheme } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [clubId, setClubId] = useState<number | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(defaultTrainingDate);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [topic, setTopic] = useState('');
  const [venue, setVenue] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saveTrainingCelebration, setSaveTrainingCelebration] = useState(false);
  const trainingSavePulse = useRef(new Animated.Value(1)).current;

  const trainingStyle = useMemo(
    () => buildTrainingRichTheme(colors, colorScheme),
    [colors, colorScheme],
  );
  const { theme: trainingCardTheme, stripeColor, palette: trainingPalette } = trainingStyle;

  const dateLabel = useMemo(
    () =>
      scheduledAt.toLocaleDateString('sr-Latn', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [scheduledAt],
  );
  const timeLabel = useMemo(
    () =>
      scheduledAt.toLocaleTimeString('sr-Latn', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [scheduledAt],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data: cid, error: cErr } = await supabase.rpc('my_trener_or_klub_club_id');
    if (cErr) {
      setErrorMessage(cErr.message);
      setLoading(false);
      return;
    }
    const resolvedClub = typeof cid === 'number' ? cid : cid == null ? null : Number(cid);
    setClubId(resolvedClub);
    if (!resolvedClub) {
      setData(null);
      setLoading(false);
      return;
    }
    const { data: res, error } = await supabase.rpc('get_club_trainings', {
      p_club_id: resolvedClub,
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

  useScreenPullRefresh(load);

  const clearTrainingSaveCelebration = useCallback(() => {
    setSaveTrainingCelebration(false);
  }, []);

  useEffect(() => {
    if (!saveTrainingCelebration) {
      trainingSavePulse.setValue(0.88);
      return;
    }
    trainingSavePulse.setValue(0.78);
    Animated.timing(trainingSavePulse, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => {
      clearTrainingSaveCelebration();
      setShowForm(false);
      setScheduledAt(defaultTrainingDate());
      setDateStr('');
      setTimeStr('');
      setTopic('');
      setVenue('');
      setNote('');
      router.replace('/trener' as never);
    }, 3000);
    return () => clearTimeout(t);
  }, [saveTrainingCelebration, clearTrainingSaveCelebration, trainingSavePulse]);

  const onCreate = async () => {
    if (!clubId) return;
    setErrorMessage('');
    if (!topic.trim()) {
      setErrorMessage('Tema treninga je obavezna.');
      return;
    }
    let iso: string | null;
    if (Platform.OS === 'web') {
      if (!dateStr.trim() || !timeStr.trim()) {
        setErrorMessage('Unesi datum i vreme treninga.');
        return;
      }
      iso = toIsoFromLocal(dateStr.trim(), timeStr.trim());
      if (!iso) {
        setErrorMessage('Format: datum YYYY-MM-DD, vreme HH:MM.');
        return;
      }
    } else {
      iso = dateToIsoUtc(scheduledAt);
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('create_training', {
      p_club_id: clubId,
      p_scheduled_at: iso,
      p_topic: topic,
      p_venue: venue,
      p_note: note,
    });
    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    void load();
    setSaveTrainingCelebration(true);
  };

  const confirmDeleteTraining = (id: number) => {
    Alert.alert('Obriši trening', 'Da li si siguran?', [
      { text: 'Otkaži', style: 'cancel' },
      {
        text: 'Obriši',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('delete_training', { p_training_id: id });
          if (error) {
            Alert.alert('Greška', error.message);
            return;
          }
          await load();
        },
      },
    ]);
  };

  const body = (
    <View style={embedded ? styles.embedded : styles.standalone}>
      {!embedded ? (
        <ThemedText type="title" style={[styles.standaloneTitle, { color: colors.text }]}>
          Treninzi
        </ThemedText>
      ) : null}

      {data?.can_manage ? (
        <View style={[styles.addRow, embedded && styles.addRowEmbedded]}>
          <Pressable
            style={[
              styles.addButton,
              {
                borderColor: trainingPalette.navy,
                backgroundColor: trainingPalette.cardSurface,
              },
            ]}
            onPress={() => setShowForm((v) => !v)}
          >
            <MaterialIcons name="bolt" size={16} color={trainingPalette.yellow} />
            <ThemedText style={[styles.addButtonText, { color: trainingPalette.navy }]}>
              {showForm ? 'Zatvori' : 'Dodaj trening'}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {showForm ? (
        <ThemedView
          style={[
            styles.formCard,
            { borderColor: colors.borderStrong, backgroundColor: colors.surface },
          ]}
        >
          <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
            Novi trening
          </ThemedText>
          {Platform.OS === 'web' ? (
            <>
              <ThemedText style={[styles.fieldHint, { color: colors.textSecondary }]}>
                Datum i vreme (web)
              </ThemedText>
              <ThemedTextInput
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="Datum (YYYY-MM-DD)"
                style={styles.inputSpacing}
                autoCapitalize="none"
              />
              <ThemedTextInput
                value={timeStr}
                onChangeText={setTimeStr}
                placeholder="Vreme (HH:MM)"
                style={styles.inputSpacing}
                autoCapitalize="none"
              />
            </>
          ) : (
            <>
              <ThemedText style={[styles.fieldHint, { color: colors.textSecondary }]}>
                Termin treninga
              </ThemedText>
              <View style={styles.pickerRow}>
                <Pressable
                  style={[
                    styles.pickerBtn,
                    { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
                  ]}
                  onPress={() => {
                    setTimePickerOpen(false);
                    setDatePickerOpen((v) => !v);
                  }}
                >
                  <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                    {dateLabel}
                  </ThemedText>
                  <ThemedText style={{ color: colors.textMuted, fontSize: 12 }}>Datum</ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.pickerBtn,
                    { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
                  ]}
                  onPress={() => {
                    setDatePickerOpen(false);
                    setTimePickerOpen((v) => !v);
                  }}
                >
                  <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                    {timeLabel}
                  </ThemedText>
                  <ThemedText style={{ color: colors.textMuted, fontSize: 12 }}>Vreme</ThemedText>
                </Pressable>
              </View>
              {datePickerOpen ? (
                <DateTimePicker
                  value={scheduledAt}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(ev, d) => {
                    if (Platform.OS === 'android') setDatePickerOpen(false);
                    if (ev.type === 'set' && d) {
                      setScheduledAt((prev) => {
                        const n = new Date(prev);
                        n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                        return n;
                      });
                    }
                  }}
                />
              ) : null}
              {timePickerOpen ? (
                <DateTimePicker
                  value={scheduledAt}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minuteInterval={5}
                  onChange={(ev, d) => {
                    if (Platform.OS === 'android') setTimePickerOpen(false);
                    if (ev.type === 'set' && d) {
                      setScheduledAt((prev) => {
                        const n = new Date(prev);
                        n.setHours(d.getHours(), d.getMinutes(), 0, 0);
                        return n;
                      });
                    }
                  }}
                />
              ) : null}
            </>
          )}
          <ThemedTextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="Tema"
            style={styles.inputSpacing}
          />
          <ThemedTextInput
            value={venue}
            onChangeText={setVenue}
            placeholder="Mesto (opciono)"
            style={styles.inputSpacing}
          />
          <ThemedTextInput
            value={note}
            onChangeText={setNote}
            placeholder="Napomena (opciono)"
            style={[styles.inputSpacing, styles.inputMulti]}
            multiline
          />
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: saveTrainingCelebration ? CELEBRATION_GREEN : colors.tint,
              },
              saveTrainingCelebration && styles.buttonCelebrationPad,
              (submitting || saveTrainingCelebration) && styles.buttonDisabled,
            ]}
            onPress={onCreate}
            disabled={submitting || saveTrainingCelebration}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : saveTrainingCelebration ? (
              <View style={styles.celebrationRow}>
                <Animated.View style={{ transform: [{ scale: trainingSavePulse }] }}>
                  <MaterialIcons
                    name="check-circle"
                    size={26}
                    color="#FFFFFF"
                    accessibilityLabel="Trening kreiran"
                  />
                </Animated.View>
                <ThemedText
                  lightColor="#FFFFFF"
                  darkColor="#FFFFFF"
                  style={styles.celebrationText}
                >
                  Trening kreiran
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.buttonText}>Sačuvaj trening</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      ) : null}

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
      {!loading && !errorMessage && !clubId ? (
        <ThemedView
          style={[
            styles.hintCard,
            { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
          ]}
        >
          <ThemedText style={{ color: colors.text }}>Nisi dodeljen nijednom klubu.</ThemedText>
        </ThemedView>
      ) : null}

      {data && clubId ? (
        <>
          {!loading && data.trainings.length === 0 ? (
            <ThemedText style={[styles.emptyHint, { color: colors.textSecondary }]}>
              Još nema zakazanih treninga — izaberi dan na kalendaru ili dodaj novi trening.
            </ThemedText>
          ) : null}
          <View style={styles.trainingLegend}>
            <MaterialIcons name="bolt" size={14} color={trainingPalette.yellow} />
            <ThemedText style={[styles.trainingLegendText, { color: colors.textSecondary }]}>
              Plavo-žuti kalendar označava dane sa treningom
            </ThemedText>
          </View>
          <MatchTimetableCalendar
            matches={data.trainings}
            scheduleDotColor={trainingPalette.yellow}
            accentColor={trainingPalette.navy}
            accentWash={trainingPalette.wash}
            scheduleDayMarker="bolt"
            listHeading={(d) =>
              `Treninzi za ${d.toLocaleDateString('sr-Latn', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}`
            }
            emptyDayMessage="Nema treninga za ovaj dan."
            renderMatch={(t) => (
              <TrainingRichCard
                theme={trainingCardTheme}
                stripeColor={stripeColor}
                topic={t.topic}
                scheduledIso={t.scheduled_at}
                venue={t.venue}
                note={t.note}
                playersPresent={t.players_present}
                playersTotal={t.players_total}
                onPress={() => router.push(`/trener/trening/${t.id}` as never)}
                onDelete={data.can_manage ? () => confirmDeleteTraining(t.id) : undefined}
              />
            )}
          />
        </>
      ) : null}
    </View>
  );

  if (embedded) return body;
  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>{body}</RefreshableScrollView>
  );
}

function dateToIsoUtc(d: Date): string {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    0,
    0,
  ).toISOString();
}

function toIsoFromLocal(dateStr: string, timeStr: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!dateMatch || !timeMatch) return null;
  const [, y, m, d] = dateMatch;
  const [, hh, mm] = timeMatch;
  const h = Number(hh);
  const min = Number(mm);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const dt = new Date(Number(y), Number(m) - 1, Number(d), h, min, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
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
  /** Razmak od chipova u hub-u — ostatak daje `index` (gap 15). */
  addRowEmbedded: { marginTop: 0 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  addButtonText: { fontWeight: '700', fontSize: 15 },
  trainingLegend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trainingLegendText: { fontSize: 12, flex: 1 },
  formCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  hintCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { fontWeight: '600' },
  emptyHint: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  inputSpacing: { marginTop: 6 },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  fieldHint: { fontSize: 12, marginTop: 4 },
  pickerRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  pickerBtn: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 4,
  },
  button: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCelebrationPad: { paddingHorizontal: 12 },
  celebrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  celebrationText: { fontWeight: '700', fontSize: 15 },
  buttonText: { color: '#fff', fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
});
