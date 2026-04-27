import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Region = { id: number; name: string };
type League = { id: number; name: string; region_id: number; season: string | null };
type Group = { id: number; league_id: number; name: string };
type Club = { id: number; name: string };
type GroupClub = { group_id: number; club_id: number };

export default function DodajUtakmicuScreen() {
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

  const [scheduledAt, setScheduledAt] = useState('');
  const [venue, setVenue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

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
    [leagues, regionId]
  );
  const filteredGroups = useMemo(
    () => groups.filter((g) => g.league_id === leagueId),
    [groups, leagueId]
  );
  const groupClubIds = useMemo(
    () => groupClubs.filter((gc) => gc.group_id === groupId).map((gc) => gc.club_id),
    [groupClubs, groupId]
  );
  const filteredClubs = useMemo(
    () => clubs.filter((c) => groupClubIds.includes(c.id)),
    [clubs, groupClubIds]
  );

  const onSubmit = async () => {
    if (!leagueId || !homeClubId || !awayClubId || !scheduledAt.trim()) {
      setResult('Liga, domacin, gost i termin su obavezni.');
      return;
    }
    if (homeClubId === awayClubId) {
      setResult('Domacin i gost moraju biti razliciti.');
      return;
    }
    const parsedDate = new Date(scheduledAt);
    if (Number.isNaN(parsedDate.getTime())) {
      setResult('Nevazeci format datuma. Koristi YYYY-MM-DDTHH:MM.');
      return;
    }

    setLoading(true);
    setResult('');
    const { error } = await supabase.from('matches').insert({
      league_id: leagueId,
      group_id: groupId,
      home_club_id: homeClubId,
      away_club_id: awayClubId,
      scheduled_at: parsedDate.toISOString(),
      venue: venue.trim() || null,
      status: 'scheduled',
    });
    setLoading(false);

    if (error) {
      setResult(`ERROR: ${error.message}`);
      return;
    }
    setResult('OK: Utakmica zakazana.');
    setScheduledAt('');
    setVenue('');
    setHomeClubId(null);
    setAwayClubId(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">Zakazi utakmicu</ThemedText>

      {/* 1) Regija */}
      <ThemedText type="subtitle">1. Regija</ThemedText>
      <ThemedView style={styles.chipRow}>
        {regions.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => {
              setRegionId(r.id);
              setLeagueId(null);
              setGroupId(null);
              setHomeClubId(null);
              setAwayClubId(null);
            }}
            style={[styles.chip, regionId === r.id && styles.chipActive]}>
            <ThemedText style={regionId === r.id ? styles.chipActiveText : undefined}>
              {r.name}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>

      {/* 2) Liga */}
      {regionId ? (
        <>
          <ThemedText type="subtitle">2. Liga</ThemedText>
          <ThemedView style={styles.chipRow}>
            {filteredLeagues.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => {
                  setLeagueId(l.id);
                  setGroupId(null);
                  setHomeClubId(null);
                  setAwayClubId(null);
                }}
                style={[styles.chip, leagueId === l.id && styles.chipActive]}>
                <ThemedText style={leagueId === l.id ? styles.chipActiveText : undefined}>
                  {l.name}
                </ThemedText>
              </Pressable>
            ))}
            {filteredLeagues.length === 0 ? <ThemedText>Nema liga u ovoj regiji.</ThemedText> : null}
          </ThemedView>
        </>
      ) : null}

      {/* 3) Grupa */}
      {leagueId ? (
        <>
          <ThemedText type="subtitle">3. Grupa</ThemedText>
          <ThemedView style={styles.chipRow}>
            {filteredGroups.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => {
                  setGroupId(g.id);
                  setHomeClubId(null);
                  setAwayClubId(null);
                }}
                style={[styles.chip, groupId === g.id && styles.chipActive]}>
                <ThemedText style={groupId === g.id ? styles.chipActiveText : undefined}>
                  {g.name}
                </ThemedText>
              </Pressable>
            ))}
            {filteredGroups.length === 0 ? <ThemedText>Nema grupa u ligi.</ThemedText> : null}
          </ThemedView>
        </>
      ) : null}

      {/* 4) Home + Away */}
      {groupId ? (
        <>
          <ThemedText type="subtitle">4. Domacin</ThemedText>
          <ThemedView style={styles.chipRow}>
            {filteredClubs.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setHomeClubId(c.id)}
                style={[styles.chip, homeClubId === c.id && styles.chipActive]}>
                <ThemedText style={homeClubId === c.id ? styles.chipActiveText : undefined}>
                  {c.name}
                </ThemedText>
              </Pressable>
            ))}
            {filteredClubs.length === 0 ? <ThemedText>Nema klubova u grupi.</ThemedText> : null}
          </ThemedView>

          <ThemedText type="subtitle">5. Gost</ThemedText>
          <ThemedView style={styles.chipRow}>
            {filteredClubs
              .filter((c) => c.id !== homeClubId)
              .map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setAwayClubId(c.id)}
                  style={[styles.chip, awayClubId === c.id && styles.chipActive]}>
                  <ThemedText style={awayClubId === c.id ? styles.chipActiveText : undefined}>
                    {c.name}
                  </ThemedText>
                </Pressable>
              ))}
          </ThemedView>
        </>
      ) : null}

      {/* 6) Termin + mesto */}
      {homeClubId && awayClubId ? (
        <>
          <ThemedText type="subtitle">6. Termin i mesto</ThemedText>
          <TextInput
            value={scheduledAt}
            onChangeText={setScheduledAt}
            placeholder="YYYY-MM-DDTHH:MM (npr. 2026-05-10T19:30)"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={venue}
            onChangeText={setVenue}
            placeholder="Mesto (npr. Hala Pionir) - opciono"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Zakazi utakmicu</ThemedText>
            )}
          </Pressable>
        </>
      ) : null}

      {result ? (
        <ThemedView style={styles.card}>
          <ThemedText>{result}</ThemedText>
        </ThemedView>
      ) : null}
    </ScrollView>
  );
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
  input: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#111',
    backgroundColor: '#fff',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  chipActiveText: { color: '#fff', fontWeight: '600' },
  button: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
