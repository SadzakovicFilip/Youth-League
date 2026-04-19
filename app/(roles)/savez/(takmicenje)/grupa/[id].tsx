import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Group = { id: number; league_id: number; name: string };
type Club = { id: number; name: string; league_id: number | null };
type Match = {
  id: number;
  league_id: number;
  group_id: number | null;
  home_club_id: number;
  away_club_id: number;
  home_club_name: string | null;
  away_club_name: string | null;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

type MatchRow = {
  id: number;
  league_id: number;
  group_id: number | null;
  home_club_id: number;
  away_club_id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

export default function GrupaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [group, setGroup] = useState<Group | null>(null);
  const [leagueClubs, setLeagueClubs] = useState<Club[]>([]);
  const [inGroupIds, setInGroupIds] = useState<number[]>([]);
  const [otherGroupClubIds, setOtherGroupClubIds] = useState<Set<number>>(new Set());
  const [matches, setMatches] = useState<Match[]>([]);

  const loadAll = useCallback(async () => {
    if (!Number.isFinite(groupId)) {
      setErrorMessage('Nevazeca grupa.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase.rpc('get_group_detail', { p_group_id: groupId });
    if (error) {
      setErrorMessage(error.message);
      setGroup(null);
      setLeagueClubs([]);
      setInGroupIds([]);
      setOtherGroupClubIds(new Set());
      setMatches([]);
      setLoading(false);
      return;
    }

    const payload = (data ?? {}) as {
      group: Group | null;
      league_clubs: Club[];
      in_group_ids: number[];
      in_other_groups_ids: number[];
      matches: Match[];
    };
    setGroup(payload.group ?? null);
    setLeagueClubs(payload.league_clubs ?? []);
    setInGroupIds(payload.in_group_ids ?? []);
    setOtherGroupClubIds(new Set(payload.in_other_groups_ids ?? []));
    let resolvedMatches = Array.isArray(payload.matches) ? payload.matches : [];

    // Compatibility fallback: if SQL function is still old (without "matches"),
    // fetch group matches directly so screen still shows correct data.
    if (!Array.isArray(payload.matches)) {
      const { data: matchRows, error: matchErr } = await supabase
        .from('matches')
        .select(
          'id, league_id, group_id, home_club_id, away_club_id, scheduled_at, venue, status, home_score, away_score'
        )
        .eq('group_id', groupId)
        .order('scheduled_at', { ascending: true });

      if (matchErr) {
        setErrorMessage(matchErr.message);
      } else {
        const clubsById = new Map((payload.league_clubs ?? []).map((c) => [c.id, c.name]));
        resolvedMatches = ((matchRows ?? []) as MatchRow[]).map((m) => ({
          ...m,
          home_club_name: clubsById.get(m.home_club_id) ?? null,
          away_club_name: clubsById.get(m.away_club_id) ?? null,
        }));
      }
    }

    setMatches(resolvedMatches);
    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const inGroupSet = useMemo(() => new Set(inGroupIds), [inGroupIds]);

  const toggle = async (clubId: number, isIn: boolean) => {
    setErrorMessage('');
    if (isIn) {
      const { error } = await supabase
        .from('group_clubs')
        .delete()
        .eq('group_id', groupId)
        .eq('club_id', clubId);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('group_clubs')
        .insert({ group_id: groupId, club_id: clubId });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
    }
    await loadAll();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">{group?.name ?? 'Grupa'}</ThemedText>
      <ThemedText>Dodaj ili ukloni klubove iz ove grupe.</ThemedText>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      <ThemedText type="subtitle">U grupi ({inGroupSet.size})</ThemedText>
      {[...inGroupSet].map((cid) => {
        const c = leagueClubs.find((x) => x.id === cid);
        return (
          <ThemedView key={cid} style={styles.clubRow}>
            <Pressable
              style={styles.clubOpen}
              onPress={() => router.push(`/savez/klub/${cid}`)}>
              <ThemedText type="defaultSemiBold">{c?.name ?? `#${cid}`}</ThemedText>
              <ThemedText style={styles.clubOpenText}>Otvori tim ▸</ThemedText>
            </Pressable>
            <Pressable style={styles.removeMini} onPress={() => toggle(cid, true)}>
              <ThemedText style={styles.removeText}>Ukloni ✕</ThemedText>
            </Pressable>
          </ThemedView>
        );
      })}
      {inGroupSet.size === 0 ? <ThemedText>Nijedan klub u grupi.</ThemedText> : null}

      <ThemedText type="subtitle">Dostupni klubovi u ligi</ThemedText>
      {leagueClubs
        .filter((c) => !inGroupSet.has(c.id) && !otherGroupClubIds.has(c.id))
        .map((c) => (
          <Pressable
            key={c.id}
            style={styles.addCard}
            onPress={() => toggle(c.id, false)}>
            <ThemedText type="defaultSemiBold">{c.name}</ThemedText>
            <ThemedText style={styles.addText}>+ Dodaj</ThemedText>
          </Pressable>
        ))}
      {leagueClubs.filter((c) => !inGroupSet.has(c.id) && !otherGroupClubIds.has(c.id)).length ===
      0 ? (
        <ThemedText>Nema dostupnih klubova (svi su vec u nekoj grupi).</ThemedText>
      ) : null}

      <ThemedText type="subtitle" style={{ marginTop: 12 }}>
        Utakmice ({matches.length})
      </ThemedText>
      {matches.length === 0 ? (
        <ThemedText>Nema zakazanih utakmica u ovoj grupi.</ThemedText>
      ) : null}
      {matches.map((m) => (
        <ThemedView key={m.id} style={styles.matchCard}>
          <ThemedText type="defaultSemiBold">
            {m.home_club_name ?? `#${m.home_club_id}`} vs {m.away_club_name ?? `#${m.away_club_id}`}
          </ThemedText>
          <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
          <ThemedText>Mesto: {m.venue ?? '-'}</ThemedText>
          <ThemedText>
            Status: {m.status}
            {m.home_score != null && m.away_score != null
              ? `  |  ${m.home_score}:${m.away_score}`
              : ''}
          </ThemedText>
        </ThemedView>
      ))}
    </ScrollView>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: { fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  removeCard: {
    borderWidth: 1,
    borderColor: '#c53939',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeText: { color: '#c53939', fontWeight: '600' },
  addCard: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addText: { color: '#0a7ea4', fontWeight: '600' },
  errorText: { color: '#c53939' },
  matchCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  clubRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  clubOpen: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  clubOpenText: { color: '#0a7ea4', fontWeight: '600' },
  removeMini: {
    borderWidth: 1,
    borderColor: '#c53939',
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
});
