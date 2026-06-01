import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { DelegatCreateSudijaForm } from '@/components/delegat/delegat-create-sudija-form';
import { SearchableSelect, type SelectOption } from '@/components/shared/searchable-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { ActionAccentHex } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type LeagueRow = {
  league_id: number;
  league_name: string;
};

type SudijaRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  matches_officiated?: number;
};

type LeagueMatchRow = {
  id: number;
  sudije?: { user_id: string }[];
};

type MatchSortDir = 'asc' | 'desc';

function sudijaLabel(s: SudijaRow): string {
  return (
    s.display_name ||
    [s.first_name, s.last_name].filter(Boolean).join(' ') ||
    s.username ||
    'Sudija'
  );
}

function sudijaMatchesSearch(s: SudijaRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [sudijaLabel(s), s.username, s.phone]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function parseSudijeRpcRows(data: unknown): SudijaRow[] {
  let raw: unknown[] = [];
  if (Array.isArray(data)) {
    raw = data;
  } else if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) raw = parsed;
    } catch {
      raw = [];
    }
  }

  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    const countRaw = r.matches_officiated ?? r.matchesOfficiated;
    const count = Number(countRaw);
    return {
      user_id: String(r.user_id ?? ''),
      username: (r.username as string | null) ?? null,
      display_name: (r.display_name as string | null) ?? null,
      first_name: (r.first_name as string | null) ?? null,
      last_name: (r.last_name as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      matches_officiated: Number.isFinite(count) ? count : 0,
    };
  });
}

function buildMatchCountMap(matches: LeagueMatchRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of matches) {
    const seen = new Set<string>();
    for (const ref of m.sudije ?? []) {
      if (!ref.user_id || seen.has(ref.user_id)) continue;
      seen.add(ref.user_id);
      map.set(ref.user_id, (map.get(ref.user_id) ?? 0) + 1);
    }
  }
  return map;
}

function mergeSudijeCounts(
  list: SudijaRow[],
  ...countMaps: Map<string, number>[]
): SudijaRow[] {
  return list.map((s) => {
    const fromRpc = Number(s.matches_officiated ?? 0);
    const fromMaps = countMaps.reduce((max, map) => Math.max(max, map.get(s.user_id) ?? 0), 0);
    return {
      ...s,
      matches_officiated: Math.max(fromRpc, fromMaps),
    };
  });
}

async function fetchSudijaMatchCountsFromOfficials(leagueId: number): Promise<Map<string, number>> {
  const { data: matchRows, error: matchErr } = await supabase
    .from('matches')
    .select('id')
    .eq('league_id', leagueId);
  if (matchErr || !matchRows?.length) return new Map();

  const matchIds = matchRows.map((m) => m.id);
  const { data: officials, error: officialsErr } = await supabase
    .from('match_officials')
    .select('match_id, user_id')
    .in('match_id', matchIds)
    .eq('role', 'sudija');
  if (officialsErr || !officials?.length) return new Map();

  const byUser = new Map<string, Set<number>>();
  for (const row of officials) {
    if (!row.user_id) continue;
    let set = byUser.get(row.user_id);
    if (!set) {
      set = new Set();
      byUser.set(row.user_id, set);
    }
    set.add(row.match_id);
  }

  const counts = new Map<string, number>();
  for (const [userId, matchSet] of byUser) {
    counts.set(userId, matchSet.size);
  }
  return counts;
}

export default function DelegatSudijeScreen() {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [sudije, setSudije] = useState<SudijaRow[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDir, setSortDir] = useState<MatchSortDir>('desc');
  const selectedLeagueIdRef = useRef<number | null>(null);

  const pickLeagueId = useCallback((rows: LeagueRow[], prev: number | null): number | null => {
    if (rows.length === 0) return null;
    if (prev != null && rows.some((r) => r.league_id === prev)) return prev;
    return rows[0].league_id;
  }, []);

  const applySelectedLeagueId = useCallback((id: number | null) => {
    selectedLeagueIdRef.current = id;
    setSelectedLeagueId(id);
  }, []);

  const loadSudije = useCallback(async (leagueId: number) => {
    const [sRes, mRes, officialsCounts] = await Promise.all([
      supabase.rpc('get_league_sudije', { p_league_id: leagueId }),
      supabase.rpc('get_league_matches', { p_league_id: leagueId }),
      fetchSudijaMatchCountsFromOfficials(leagueId),
    ]);
    if (sRes.error) {
      setErrorMessage(sRes.error.message);
      setSudije([]);
      return;
    }
    const list = parseSudijeRpcRows(sRes.data);
    const matches = mRes.error ? [] : ((mRes.data ?? []) as LeagueMatchRow[]);
    if (mRes.error && officialsCounts.size === 0) {
      setErrorMessage(mRes.error.message);
    }
    setSudije(mergeSudijeCounts(list, buildMatchCountMap(matches), officialsCounts));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.rpc('get_delegate_leagues');
    if (error) {
      setErrorMessage(error.message);
      setLeagues([]);
      applySelectedLeagueId(null);
      setSudije([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as LeagueRow[];
    setLeagues(rows);
    const leagueIdToLoad = pickLeagueId(rows, selectedLeagueIdRef.current);
    applySelectedLeagueId(leagueIdToLoad);
    if (leagueIdToLoad != null) {
      await loadSudije(leagueIdToLoad);
    } else {
      setSudije([]);
    }
    setLoading(false);
  }, [applySelectedLeagueId, loadSudije, pickLeagueId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useScreenPullRefresh(load);

  const leagueOptions = useMemo<SelectOption[]>(
    () =>
      leagues.map((l) => ({
        value: String(l.league_id),
        label: l.league_name,
      })),
    [leagues],
  );

  const selectedLeagueName = useMemo(
    () => leagues.find((l) => l.league_id === selectedLeagueId)?.league_name ?? null,
    [leagues, selectedLeagueId],
  );

  const visibleSudije = useMemo(() => {
    const filtered = sudije.filter((s) => sudijaMatchesSearch(s, searchQuery));
    return [...filtered].sort((a, b) => {
      const diff = (a.matches_officiated ?? 0) - (b.matches_officiated ?? 0);
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [searchQuery, sortDir, sudije]);

  const sudijeCountLabel =
    searchQuery.trim() && visibleSudije.length !== sudije.length
      ? `${visibleSudije.length} / ${sudije.length}`
      : String(sudije.length);

  const onLeagueChange = async (v: string | null) => {
    if (v == null) return;
    const id = Number(v);
    if (!Number.isFinite(id)) return;
    applySelectedLeagueId(id);
    setShowAddForm(false);
    setSearchQuery('');
    setLoading(true);
    setErrorMessage('');
    await loadSudije(id);
    setLoading(false);
  };

  const onSudijaCreated = async () => {
    setShowAddForm(false);
    if (selectedLeagueId != null) {
      await loadSudije(selectedLeagueId);
    }
  };

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      {loading ? <ActivityIndicator color={colors.tint} /> : null}

      {errorMessage ? (
        <ThemedView style={[styles.card, { borderColor: colors.borderStrong }]}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && leagues.length === 0 ? (
        <ThemedView style={[styles.card, { borderColor: colors.borderStrong }]}>
          <ThemedText style={{ color: colors.textSecondary }}>Nisi delegat ni u jednoj ligi.</ThemedText>
        </ThemedView>
      ) : null}

      {leagues.length > 0 && selectedLeagueId != null ? (
        <>
          <SearchableSelect
            label="Liga"
            placeholder="Izaberi ligu"
            sheetTitle="Liga"
            value={String(selectedLeagueId)}
            options={leagueOptions}
            clearable={false}
            onChange={onLeagueChange}
          />

          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={{ color: colors.text }}>
              Sudije ({sudijeCountLabel})
            </ThemedText>
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                setErrorMessage('');
                setShowAddForm((v) => !v);
              }}>
              <ThemedText style={styles.addBtnText}>{showAddForm ? 'Zatvori' : 'Dodaj'}</ThemedText>
            </Pressable>
          </View>

          {sudije.length > 0 ? (
            <View style={styles.toolbar}>
              <ThemedTextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Pretraži sudije..."
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                style={[styles.searchInput, { borderColor: colors.inputBorder }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  sortDir === 'desc'
                    ? 'Sortirano po broju utakmica, opadajuće'
                    : 'Sortirano po broju utakmica, rastuće'
                }
                onPress={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                style={({ pressed }) => [
                  styles.sortBtn,
                  { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
                  pressed ? { opacity: 0.88 } : null,
                ]}>
                <MaterialIcons
                  name="arrow-upward"
                  size={13}
                  color={sortDir === 'asc' ? colors.tint : colors.textMuted}
                />
                <MaterialIcons
                  name="arrow-downward"
                  size={13}
                  color={sortDir === 'desc' ? colors.tint : colors.textMuted}
                  style={styles.sortArrowDown}
                />
              </Pressable>
            </View>
          ) : null}

          {showAddForm ? (
            <DelegatCreateSudijaForm
              leagueId={selectedLeagueId}
              leagueName={selectedLeagueName}
              onCreated={onSudijaCreated}
              onError={setErrorMessage}
            />
          ) : null}

          {sudije.length === 0 ? (
            <ThemedText style={{ color: colors.textSecondary }}>Nema sudija u ovoj ligi.</ThemedText>
          ) : visibleSudije.length === 0 ? (
            <ThemedText style={{ color: colors.textSecondary }}>Nema sudija za tu pretragu.</ThemedText>
          ) : (
            visibleSudije.map((s) => {
              const count = s.matches_officiated ?? 0;
              return (
                <Pressable
                  key={s.user_id}
                  onPress={() => router.push(`/delegat/sudija/${s.user_id}` as never)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
                  <ThemedView
                    style={[
                      styles.sudijaCard,
                      { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
                    ]}>
                    <View style={styles.sudijaMain}>
                      <ThemedText type="defaultSemiBold" style={{ color: colors.text }} numberOfLines={2}>
                        {sudijaLabel(s)}
                      </ThemedText>
                      {s.username ? (
                        <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
                          @{s.username}
                        </ThemedText>
                      ) : null}
                    </View>
                    <View style={styles.sudijaTail}>
                      <View style={styles.whistleRow}>
                        <MaterialCommunityIcons name="whistle" size={18} color={colors.tint} />
                        <ThemedText type="defaultSemiBold" style={{ color: colors.tint, fontSize: 16 }}>
                          {count}
                        </ThemedText>
                      </View>
                      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
                    </View>
                  </ThemedView>
                </Pressable>
              );
            })
          )}
        </>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12 },
  errorText: { color: '#c53939' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: { color: ActionAccentHex, fontWeight: '700' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    marginTop: 0,
  },
  sortBtn: {
    width: 36,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortArrowDown: { marginTop: -5 },
  sudijaCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sudijaMain: { flex: 1, minWidth: 0, gap: 2 },
  sudijaTail: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whistleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
