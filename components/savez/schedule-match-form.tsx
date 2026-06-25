import { ActionAccentHex } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { SearchableSelect, type SelectOption } from '@/components/shared/searchable-select';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { triggerPressInFeedback, type AppFeedbackKind } from '@/lib/app-feedback';

type Region = { id: number; name: string };
type League = { id: number; name: string; region_id: number; season: string | null };
type Group = { id: number; league_id: number; name: string };
type Club = { id: number; name: string };
type GroupClub = { group_id: number; club_id: number };

/** Jače zelena za uspešno zakazivanje (dugme). */
const CELEBRATION_GREEN = '#047857';

function mergeDateAndTime(datePart: Date, timePart: Date): Date {
  return new Date(
    datePart.getFullYear(),
    datePart.getMonth(),
    datePart.getDate(),
    timePart.getHours(),
    timePart.getMinutes(),
    0,
    0,
  );
}

function formatDateSr(d: Date): string {
  return d.toLocaleDateString('sr-Latn', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime24(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseWebDateTime(dateStr: string, timeStr: string): Date | null {
  const ds = dateStr.trim();
  const ts = timeStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return null;
  const tm = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(ts);
  if (!tm) return null;
  const h = Number(tm[1]);
  const m = Number(tm[2]);
  const [Y, M, D] = ds.split('-').map(Number);
  const dt = new Date(Y, M - 1, D, h, m, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function ScheduleMatchForm({ pressFeedback }: { pressFeedback?: AppFeedbackKind }) {
  const PressableWithFeedback = useMemo(() => {
    if (!pressFeedback) return Pressable;
    return function FeedbackPressable(props: React.ComponentProps<typeof Pressable>) {
      return (
        <Pressable
          {...props}
          onPressIn={(ev) => {
            triggerPressInFeedback(pressFeedback);
            props.onPressIn?.(ev);
          }}
        />
      );
    };
  }, [pressFeedback]);
  const Btn = PressableWithFeedback;
  const { colors, colorScheme } = useAppTheme();
  const [regions, setRegions] = useState<Region[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [groupClubs, setGroupClubs] = useState<GroupClub[]>([]);

  const [regionId, setRegionId] = useState<number | null>(null);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [homeClubId, setHomeClubId] = useState<number | null>(null);
  const [awayClubId, setAwayClubId] = useState<number | null>(null);

  const [matchDate, setMatchDate] = useState<Date | null>(null);
  const [matchTime, setMatchTime] = useState<Date | null>(null);
  const [webDateStr, setWebDateStr] = useState('');
  const [webTimeStr, setWebTimeStr] = useState('');

  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [draftDate, setDraftDate] = useState(() => new Date());
  const [draftTime, setDraftTime] = useState(() => {
    const t = new Date();
    t.setHours(19, 0, 0, 0);
    return t;
  });

  const [androidDateOpen, setAndroidDateOpen] = useState(false);
  const [androidTimeOpen, setAndroidTimeOpen] = useState(false);

  const [venue, setVenue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [celebration, setCelebration] = useState(false);
  const successPulse = useRef(new Animated.Value(1)).current;

  const isWeb = Platform.OS === 'web';
  const isAndroid = Platform.OS === 'android';
  /** iOS, Windows, itd. — Android koristi sistemski dijalog, web tekstualna polja */
  const useSheetPickers = !isWeb && !isAndroid;

  useEffect(() => {
    const loadAll = async () => {
      const [rRes, lRes, gRes, cRes, gcRes] = await Promise.all([
        supabase.from('regions').select('id, name').order('name'),
        supabase.from('leagues').select('id, name, region_id, season').order('name'),
        supabase.from('league_groups').select('id, league_id, name').order('name'),
        supabase.from('clubs').select('id, name').order('name'),
        supabase.from('group_clubs').select('group_id, club_id'),
      ]);
      setRegions((rRes.data ?? []) as Region[]);
      setLeagues((lRes.data ?? []) as League[]);
      setGroups((gRes.data ?? []) as Group[]);
      setClubs((cRes.data ?? []) as Club[]);
      setGroupClubs((gcRes.data ?? []) as GroupClub[]);
    };
    loadAll();
  }, []);

  const filteredLeagues = useMemo(
    () => leagues.filter((l) => l.region_id === regionId),
    [leagues, regionId],
  );
  const filteredGroups = useMemo(
    () => groups.filter((g) => g.league_id === leagueId),
    [groups, leagueId],
  );
  const groupClubIds = useMemo(
    () => groupClubs.filter((gc) => gc.group_id === groupId).map((gc) => gc.club_id),
    [groupClubs, groupId],
  );
  const filteredClubs = useMemo(
    () => clubs.filter((c) => groupClubIds.includes(c.id)),
    [clubs, groupClubIds],
  );

  const regionOptions = useMemo<SelectOption[]>(
    () => regions.map((r) => ({ value: String(r.id), label: r.name })),
    [regions],
  );
  const leagueOptions = useMemo<SelectOption[]>(
    () =>
      filteredLeagues.map((l) => ({
        value: String(l.id),
        label: l.name,
        sublabel: l.season ? `Sezona: ${l.season}` : undefined,
      })),
    [filteredLeagues],
  );
  const groupOptions = useMemo<SelectOption[]>(
    () => filteredGroups.map((g) => ({ value: String(g.id), label: g.name })),
    [filteredGroups],
  );
  const clubOptions = useMemo<SelectOption[]>(
    () => filteredClubs.map((c) => ({ value: String(c.id), label: c.name })),
    [filteredClubs],
  );

  const onRegionChange = (v: string | null) => {
    const id = v != null && v !== '' ? Number(v) : null;
    setRegionId(id != null && Number.isFinite(id) ? id : null);
    setLeagueId(null);
    setGroupId(null);
    setHomeClubId(null);
    setAwayClubId(null);
  };

  const onLeagueChange = (v: string | null) => {
    const id = v != null && v !== '' ? Number(v) : null;
    setLeagueId(id != null && Number.isFinite(id) ? id : null);
    setGroupId(null);
    setHomeClubId(null);
    setAwayClubId(null);
  };

  const onGroupChange = (v: string | null) => {
    const id = v != null && v !== '' ? Number(v) : null;
    setGroupId(id != null && Number.isFinite(id) ? id : null);
    setHomeClubId(null);
    setAwayClubId(null);
  };

  const scheduledAtDate = useMemo(() => {
    if (isWeb) return parseWebDateTime(webDateStr, webTimeStr);
    if (matchDate && matchTime) return mergeDateAndTime(matchDate, matchTime);
    return null;
  }, [isWeb, webDateStr, webTimeStr, matchDate, matchTime]);

  const resetFormToInitial = useCallback(() => {
    setCelebration(false);
    setResult('');
    setMatchDate(null);
    setMatchTime(null);
    setWebDateStr('');
    setWebTimeStr('');
    setVenue('');
    setHomeClubId(null);
    setAwayClubId(null);
    setRegionId(null);
    setLeagueId(null);
    setGroupId(null);
  }, []);

  useEffect(() => {
    if (!celebration) {
      successPulse.setValue(0.88);
      return;
    }
    successPulse.setValue(0.78);
    Animated.timing(successPulse, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => resetFormToInitial(), 3000);
    return () => clearTimeout(t);
  }, [celebration, resetFormToInitial, successPulse]);

  const onSubmit = async () => {
    if (!leagueId || !homeClubId || !awayClubId) {
      setResult('Liga, domacin i gost su obavezni.');
      return;
    }
    if (homeClubId === awayClubId) {
      setResult('Domacin i gost moraju biti razliciti.');
      return;
    }
    if (!scheduledAtDate) {
      setResult(
        isWeb
          ? 'Unesi datum (GGGG-MM-DD) i vreme (SS:MM, 24h).'
          : 'Izaberi datum i vreme odigravanja.',
      );
      return;
    }

    setLoading(true);
    setResult('');
    const { error } = await supabase.from('matches').insert({
      league_id: leagueId,
      group_id: groupId,
      home_club_id: homeClubId,
      away_club_id: awayClubId,
      scheduled_at: scheduledAtDate.toISOString(),
      venue: venue.trim() || null,
      status: 'scheduled',
    });
    setLoading(false);

    if (error) {
      setResult(`ERROR: ${error.message}`);
      return;
    }
    setCelebration(true);
  };

  return (
    <ScrollView
      style={styles.scrollRoot}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      keyboardDismissMode="interactive">
      <ThemedText type="title">{celebration ? 'Utakmica je Zakazana' : 'Zakazi utakmicu'}</ThemedText>

      <View pointerEvents={celebration ? 'none' : 'auto'}>
      <ThemedText type="subtitle">1. Regija</ThemedText>
      <SearchableSelect
        label="Regija"
        placeholder="Izaberi regiju"
        options={regionOptions}
        value={regionId != null ? String(regionId) : null}
        onChange={onRegionChange}
      />

      {regionId != null ? (
        <>
          <ThemedText type="subtitle">2. Liga</ThemedText>
          <SearchableSelect
            label="Liga"
            placeholder="Izaberi ligu"
            options={leagueOptions}
            value={leagueId != null ? String(leagueId) : null}
            onChange={onLeagueChange}
          />
          {leagueOptions.length === 0 ? <ThemedText>Nema liga u ovoj regiji.</ThemedText> : null}
        </>
      ) : null}

      {leagueId != null ? (
        <>
          <ThemedText type="subtitle">3. Grupa</ThemedText>
          <SearchableSelect
            label="Grupa"
            placeholder="Izaberi grupu"
            options={groupOptions}
            value={groupId != null ? String(groupId) : null}
            onChange={onGroupChange}
          />
          {groupOptions.length === 0 ? <ThemedText>Nema grupa u ligi.</ThemedText> : null}
        </>
      ) : null}

      {groupId != null ? (
        <>
          <ThemedText type="subtitle">4. Domacin</ThemedText>
          <SearchableSelect
            label="Domacin"
            placeholder="Izaberi klub"
            options={clubOptions}
            value={homeClubId != null ? String(homeClubId) : null}
            onChange={(v) => {
              const id = v != null && v !== '' ? Number(v) : null;
              setHomeClubId(id != null && Number.isFinite(id) ? id : null);
              setAwayClubId((prev) => (prev === id ? null : prev));
            }}
          />
          {clubOptions.length === 0 ? <ThemedText>Nema klubova u grupi.</ThemedText> : null}

          <ThemedText type="subtitle">5. Gost</ThemedText>
          <SearchableSelect
            label="Gost"
            placeholder="Izaberi klub"
            options={clubOptions}
            value={awayClubId != null ? String(awayClubId) : null}
            disabledValues={homeClubId != null ? [String(homeClubId)] : []}
            onChange={(v) => {
              const id = v != null && v !== '' ? Number(v) : null;
              setAwayClubId(id != null && Number.isFinite(id) ? id : null);
            }}
          />
        </>
      ) : null}

      {homeClubId && awayClubId ? (
        <>
          <ThemedText type="subtitle">6. Termin i mesto</ThemedText>
          <View style={styles.terminFieldsGap}>
            {isWeb ? (
              <>
                <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Na webu unesi datum i vreme (24h) u polja ispod.
                </ThemedText>
                <ThemedTextInput
                  value={webDateStr}
                  onChangeText={setWebDateStr}
                  placeholder="Datum: GGGG-MM-DD"
                />
                <ThemedTextInput
                  value={webTimeStr}
                  onChangeText={setWebTimeStr}
                  placeholder="Vreme: SS:MM (npr. 19:30)"
                />
              </>
            ) : (
              <>
                <Btn
                  onPress={() => {
                    setDraftDate(matchDate ? new Date(matchDate) : new Date());
                    if (isAndroid) setAndroidDateOpen(true);
                    else setDateModalVisible(true);
                  }}
                  style={[
                    styles.pickerTrigger,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}>
                  <ThemedText style={{ color: matchDate ? colors.text : colors.textMuted }}>
                    {matchDate ? formatDateSr(matchDate) : 'Dodaj datum'}
                  </ThemedText>
                </Btn>
                <Btn
                  onPress={() => {
                    const base = matchTime ? new Date(matchTime) : new Date();
                    if (!matchTime) base.setHours(19, 0, 0, 0);
                    setDraftTime(base);
                    if (isAndroid) setAndroidTimeOpen(true);
                    else setTimeModalVisible(true);
                  }}
                  style={[
                    styles.pickerTrigger,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}>
                  <ThemedText style={{ color: matchTime ? colors.text : colors.textMuted }}>
                    {matchTime ? formatTime24(matchTime) : 'Dodaj vreme'}
                  </ThemedText>
                </Btn>
                {matchDate && matchTime ? (
                  <ThemedText style={{ color: colors.textSecondary, fontSize: 14 }}>
                    Termin: {formatDateSr(matchDate)} u {formatTime24(matchTime)}
                  </ThemedText>
                ) : null}
              </>
            )}

            <ThemedTextInput
              value={venue}
              onChangeText={setVenue}
              placeholder="Mesto (npr. Hala Pionir) - opciono"
            />
          </View>

          {useSheetPickers ? (
            <>
              <Modal
                visible={dateModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setDateModalVisible(false)}>
                <View style={styles.modalRoot}>
                  <Btn
                    style={[StyleSheet.absoluteFillObject, styles.dimmedBackdrop]}
                    onPress={() => setDateModalVisible(false)}
                    accessibilityLabel="Zatvori"
                    accessibilityRole="button"
                  />
                  <View style={styles.sheetWrap} pointerEvents="box-none">
                    <ThemedView
                      style={[
                        styles.modalSheet,
                        { backgroundColor: colors.surface, borderTopColor: colors.borderStrong },
                      ]}>
                      <ThemedText type="subtitle" style={{ color: colors.text }}>
                        Datum odigravanja
                      </ThemedText>
                      <DateTimePicker
                        value={draftDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        {...(Platform.OS === 'ios'
                          ? { themeVariant: colorScheme === 'dark' ? ('dark' as const) : ('light' as const) }
                          : {})}
                        onChange={(_, d) => {
                          if (d) setDraftDate(d);
                        }}
                      />
                      <View style={styles.modalActions}>
                        <Btn
                          onPress={() => setDateModalVisible(false)}
                          style={styles.modalGhostBtn}>
                          <ThemedText style={{ color: colors.textSecondary }}>Odustani</ThemedText>
                        </Btn>
                        <Btn
                          onPress={() => {
                            setMatchDate(new Date(draftDate));
                            setDateModalVisible(false);
                          }}
                          style={[styles.modalPrimaryBtn, { backgroundColor: ActionAccentHex }]}>
                          <ThemedText style={styles.modalPrimaryBtnText}>Potvrdi</ThemedText>
                        </Btn>
                      </View>
                    </ThemedView>
                  </View>
                </View>
              </Modal>

              <Modal
                visible={timeModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setTimeModalVisible(false)}>
                <View style={styles.modalRoot}>
                  <Btn
                    style={[StyleSheet.absoluteFillObject, styles.dimmedBackdrop]}
                    onPress={() => setTimeModalVisible(false)}
                    accessibilityLabel="Zatvori"
                    accessibilityRole="button"
                  />
                  <View style={styles.sheetWrap} pointerEvents="box-none">
                    <ThemedView
                      style={[
                        styles.modalSheet,
                        { backgroundColor: colors.surface, borderTopColor: colors.borderStrong },
                      ]}>
                      <ThemedText type="subtitle" style={{ color: colors.text }}>
                        Vreme (24h)
                      </ThemedText>
                      <DateTimePicker
                        value={draftTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        is24Hour
                        {...(Platform.OS === 'ios'
                          ? { themeVariant: colorScheme === 'dark' ? ('dark' as const) : ('light' as const) }
                          : {})}
                        onChange={(_, d) => {
                          if (d) setDraftTime(d);
                        }}
                      />
                      <View style={styles.modalActions}>
                        <Btn
                          onPress={() => setTimeModalVisible(false)}
                          style={styles.modalGhostBtn}>
                          <ThemedText style={{ color: colors.textSecondary }}>Odustani</ThemedText>
                        </Btn>
                        <Btn
                          onPress={() => {
                            setMatchTime(new Date(draftTime));
                            setTimeModalVisible(false);
                          }}
                          style={[styles.modalPrimaryBtn, { backgroundColor: ActionAccentHex }]}>
                          <ThemedText style={styles.modalPrimaryBtnText}>Potvrdi</ThemedText>
                        </Btn>
                      </View>
                    </ThemedView>
                  </View>
                </View>
              </Modal>
            </>
          ) : null}

          {isAndroid && androidDateOpen ? (
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="calendar"
              onChange={(event, date) => {
                setAndroidDateOpen(false);
                if (event.type === 'set' && date) setMatchDate(new Date(date));
              }}
            />
          ) : null}
          {isAndroid && androidTimeOpen ? (
            <DateTimePicker
              value={draftTime}
              mode="time"
              is24Hour
              display="default"
              onChange={(event, date) => {
                setAndroidTimeOpen(false);
                if (event.type === 'set' && date) setMatchTime(new Date(date));
              }}
            />
          ) : null}

          <Btn
            style={[
              styles.button,
              loading && styles.buttonDisabled,
              celebration && styles.buttonCelebration,
            ]}
            onPress={onSubmit}
            disabled={loading || celebration}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : celebration ? (
              <View style={styles.buttonCelebrationRow}>
                <Animated.View style={{ transform: [{ scale: successPulse }] }}>
                  <MaterialIcons
                    name="check-circle"
                    size={28}
                    color="#FFFFFF"
                    accessibilityLabel="Zakazano"
                  />
                </Animated.View>
                <ThemedText
                  lightColor="#FFFFFF"
                  darkColor="#FFFFFF"
                  style={styles.buttonCelebrationText}>
                  Utakmica je Zakazana
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.buttonText}>Zakazi utakmicu</ThemedText>
            )}
          </Btn>
        </>
      ) : null}
      </View>

      {result && !celebration ? (
        <ThemedView style={styles.card}>
          <ThemedText>{result}</ThemedText>
        </ThemedView>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollRoot: { flex: 1 },
  container: { gap: 10, padding: 16, paddingBottom: 32 },
  terminFieldsGap: { gap: 16, marginTop: 4 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  button: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ActionAccentHex,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  buttonCelebration: {
    backgroundColor: CELEBRATION_GREEN,
    paddingHorizontal: 14,
  },
  buttonCelebrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonCelebrationText: {
    fontWeight: '700',
    fontSize: 15,
  },
  pickerTrigger: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  modalRoot: { flex: 1 },
  dimmedBackdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
    maxHeight: '88%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  modalGhostBtn: { paddingVertical: 10, paddingHorizontal: 8 },
  modalPrimaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalPrimaryBtnText: { color: '#fff', fontWeight: '600' },
});
