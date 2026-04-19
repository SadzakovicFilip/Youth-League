import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserDetailView } from '@/components/shared/user-detail-view';
import { supabase } from '@/lib/supabase';

type AttendanceRow = {
  id: number;
  training_date: string;
  status: string;
  note: string | null;
};

type FeeRow = {
  id: number;
  period_month: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  due_date: string | null;
};

type StatRow = {
  id: number;
  match_date: string;
  opponent: string | null;
  points: number;
  rebounds: number;
  assists: number;
};

type TacticRow = {
  id: number;
  club_id: number;
  title: string;
  training_date: string | null;
  created_at: string;
};

type ClubContext = {
  club_id: number;
  club_name: string;
  league_id: number | null;
  league_name: string | null;
  region_id: number | null;
  region_name: string | null;
  group_id: number | null;
  group_name: string | null;
};

type GroupClub = {
  id: number;
  name: string;
};

type MatchRow = {
  id: number;
  home_club_id: number;
  away_club_id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_club_name?: string | null;
  away_club_name?: string | null;
};

type MatchesPayload = {
  context: ClubContext | null;
  home: MatchRow[];
  away: MatchRow[];
};

type PlayerTabKey = 'attendance' | 'fees' | 'stats' | 'tactics' | 'profile' | 'league' | 'schedule';

export default function IgracHomeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [tactics, setTactics] = useState<TacticRow[]>([]);
  const [clubContext, setClubContext] = useState<ClubContext | null>(null);
  const [groupClubs, setGroupClubs] = useState<GroupClub[]>([]);
  const [homeMatches, setHomeMatches] = useState<MatchRow[]>([]);
  const [awayMatches, setAwayMatches] = useState<MatchRow[]>([]);
  const [activeTab, setActiveTab] = useState<PlayerTabKey>('attendance');

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const loadPlayerData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage('Nema aktivne sesije. Uloguj se ponovo.');
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const [attendanceRes, feesRes, statsRes, membershipsRes, clubCtxRes] = await Promise.all([
      supabase
        .from('player_attendance')
        .select('id, training_date, status, note')
        .eq('player_id', user.id)
        .order('training_date', { ascending: false })
        .limit(20),
      supabase
        .from('player_fees')
        .select('id, period_month, amount_due, amount_paid, status, due_date')
        .eq('player_id', user.id)
        .order('period_month', { ascending: false })
        .limit(12),
      supabase
        .from('player_stats')
        .select('id, match_date, opponent, points, rebounds, assists')
        .eq('player_id', user.id)
        .order('match_date', { ascending: false })
        .limit(20),
      supabase.from('club_memberships').select('club_id').eq('user_id', user.id).eq('active', true),
      supabase.rpc('get_my_club_context'),
    ]);

    if (
      attendanceRes.error ||
      feesRes.error ||
      statsRes.error ||
      membershipsRes.error ||
      clubCtxRes.error
    ) {
      setErrorMessage(
        attendanceRes.error?.message ||
          feesRes.error?.message ||
          statsRes.error?.message ||
          membershipsRes.error?.message ||
          clubCtxRes.error?.message ||
          'Greska pri ucitavanju podataka igraca.'
      );
      setLoading(false);
      return;
    }

    const clubIds = (membershipsRes.data ?? []).map((m) => m.club_id);
    const ctx = (clubCtxRes.data ?? null) as ClubContext | null;
    setClubContext(ctx);

    let tacticsRows: TacticRow[] = [];
    if (clubIds.length > 0) {
      const tacticsRes = await supabase
        .from('club_tactics')
        .select('id, club_id, title, training_date, created_at')
        .in('club_id', clubIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(30);
      if (tacticsRes.error) {
        setErrorMessage(tacticsRes.error.message);
        setLoading(false);
        return;
      }
      tacticsRows = tacticsRes.data ?? [];
    }

    let groupClubRows: GroupClub[] = [];
    if (ctx?.group_id) {
      const groupRes = await supabase
        .from('group_clubs')
        .select('club_id, clubs:clubs!inner(id, name)')
        .eq('group_id', ctx.group_id);
      if (!groupRes.error) {
        groupClubRows = (groupRes.data ?? [])
          .map((row) => {
            const c = (row as { clubs: { id: number; name: string } | { id: number; name: string }[] }).clubs;
            const club = Array.isArray(c) ? c[0] : c;
            return club ? { id: club.id, name: club.name } : null;
          })
          .filter((x): x is GroupClub => !!x)
          .sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    let homeRows: MatchRow[] = [];
    let awayRows: MatchRow[] = [];
    if (ctx?.club_id) {
      const matchesRpc = await supabase.rpc('get_klub_matches', { p_club_id: ctx.club_id });
      if (!matchesRpc.error && matchesRpc.data) {
        const payload = matchesRpc.data as MatchesPayload;
        homeRows = payload.home ?? [];
        awayRows = payload.away ?? [];
      } else {
        const [hRes, aRes] = await Promise.all([
          supabase
            .from('matches')
            .select('id, home_club_id, away_club_id, scheduled_at, venue, status, home_score, away_score')
            .eq('home_club_id', ctx.club_id)
            .order('scheduled_at', { ascending: true }),
          supabase
            .from('matches')
            .select('id, home_club_id, away_club_id, scheduled_at, venue, status, home_score, away_score')
            .eq('away_club_id', ctx.club_id)
            .order('scheduled_at', { ascending: true }),
        ]);
        if (!hRes.error) homeRows = (hRes.data ?? []) as MatchRow[];
        if (!aRes.error) awayRows = (aRes.data ?? []) as MatchRow[];
      }
    }

    setAttendance(attendanceRes.data ?? []);
    setFees(feesRes.data ?? []);
    setStats(statsRes.data ?? []);
    setTactics(tacticsRows);
    setGroupClubs(groupClubRows);
    setHomeMatches(homeRows);
    setAwayMatches(awayRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlayerData();
  }, [loadPlayerData]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Igrac Dashboard</ThemedText>
      <ThemedText style={styles.subtitle}>
        Read-only pregled: prisustvo, clanarina, statistika, taktike, profil, liga i utakmice.
      </ThemedText>

      <Link href="/home" style={styles.link}>
        Otvori shared home
      </Link>
      <Pressable style={styles.secondaryButton} onPress={onLogout}>
        <ThemedText style={styles.secondaryButtonText}>Logout</ThemedText>
      </Pressable>

      <Pressable style={styles.refreshButton} onPress={loadPlayerData}>
        <ThemedText style={styles.refreshButtonText}>Refresh</ThemedText>
      </Pressable>

      <ThemedView style={styles.tabRow}>
        <TabButton label="Prisustvo" active={activeTab === 'attendance'} onPress={() => setActiveTab('attendance')} />
        <TabButton label="Clanarina" active={activeTab === 'fees'} onPress={() => setActiveTab('fees')} />
        <TabButton label="Statistika" active={activeTab === 'stats'} onPress={() => setActiveTab('stats')} />
        <TabButton label="Taktike" active={activeTab === 'tactics'} onPress={() => setActiveTab('tactics')} />
        <TabButton label="Profil" active={activeTab === 'profile'} onPress={() => setActiveTab('profile')} />
        <TabButton label="Liga" active={activeTab === 'league'} onPress={() => setActiveTab('league')} />
        <TabButton label="Utakmice" active={activeTab === 'schedule'} onPress={() => setActiveTab('schedule')} />
      </ThemedView>

      {loading ? (
        <ThemedView style={styles.sectionCard}>
          <ActivityIndicator />
        </ThemedView>
      ) : null}

      {errorMessage ? (
        <ThemedView style={styles.sectionCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {activeTab === 'attendance' ? (
        <Section title="Moje prisustvo">
          {attendance.length === 0 ? (
            <ThemedText>Nema unosa.</ThemedText>
          ) : (
            attendance.map((row) => (
              <ThemedText key={row.id}>
                {row.training_date} - {row.status}
                {row.note ? ` (${row.note})` : ''}
              </ThemedText>
            ))
          )}
        </Section>
      ) : null}

      {activeTab === 'fees' ? (
        <Section title="Moja clanarina">
          {fees.length === 0 ? (
            <ThemedText>Nema unosa.</ThemedText>
          ) : (
            fees.map((row) => (
              <ThemedText key={row.id}>
                {row.period_month}: {row.amount_paid}/{row.amount_due} ({row.status})
              </ThemedText>
            ))
          )}
        </Section>
      ) : null}

      {activeTab === 'stats' ? (
        <Section title="Moja statistika">
          {stats.length === 0 ? (
            <ThemedText>Nema unosa.</ThemedText>
          ) : (
            stats.map((row) => (
              <ThemedText key={row.id}>
                {row.match_date} vs {row.opponent ?? 'Unknown'} - PTS {row.points}, REB {row.rebounds}, AST {row.assists}
              </ThemedText>
            ))
          )}
        </Section>
      ) : null}

      {activeTab === 'tactics' ? (
        <Section title="Taktike mog kluba">
          {tactics.length === 0 ? (
            <ThemedText>Nema aktivnih taktika.</ThemedText>
          ) : (
            tactics.map((row) => (
              <ThemedText key={row.id}>
                [{row.club_id}] {row.title}
                {row.training_date ? ` - ${row.training_date}` : ''}
              </ThemedText>
            ))
          )}
        </Section>
      ) : null}

      {activeTab === 'profile' ? (
        userId ? (
          <UserDetailView userId={userId} showBackButton={false} />
        ) : (
          <Section title="Moj profil">
            <ThemedText>Nema aktivne sesije.</ThemedText>
          </Section>
        )
      ) : null}

      {activeTab === 'league' ? (
        <Section title="Moja liga">
          {!clubContext ? (
            <ThemedText>Nisi rasporedjen ni u jedan klub.</ThemedText>
          ) : (
            <>
              <ThemedText>Klub: {clubContext.club_name}</ThemedText>
              <ThemedText>Regija: {clubContext.region_name ?? '-'}</ThemedText>
              <ThemedText>Liga: {clubContext.league_name ?? '-'}</ThemedText>
              <ThemedText>Grupa: {clubContext.group_name ?? '-'}</ThemedText>

              <ThemedText type="defaultSemiBold" style={styles.subsectionTitle}>
                Klubovi u tvojoj grupi ({groupClubs.length})
              </ThemedText>
              {groupClubs.length === 0 ? (
                <ThemedText>Grupa jos nije popunjena.</ThemedText>
              ) : (
                groupClubs.map((c) => (
                  <ThemedText key={c.id}>
                    {c.id === clubContext.club_id ? '▸ ' : '• '}
                    {c.name}
                    {c.id === clubContext.club_id ? ' (tvoj klub)' : ''}
                  </ThemedText>
                ))
              )}
            </>
          )}
        </Section>
      ) : null}

      {activeTab === 'schedule' ? (
        <>
          <Section title="Domace utakmice">
            {homeMatches.length === 0 ? (
              <ThemedText>Nema zakazanih domacih utakmica.</ThemedText>
            ) : (
              homeMatches.map((m) => (
                <ThemedView key={m.id} style={styles.matchRow}>
                  <ThemedText type="defaultSemiBold">
                    vs {m.away_club_name ?? `#${m.away_club_id}`}
                  </ThemedText>
                  <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
                  {m.venue ? <ThemedText>Mesto: {m.venue}</ThemedText> : null}
                  <ThemedText>Status: {m.status}</ThemedText>
                  {m.home_score !== null && m.away_score !== null ? (
                    <ThemedText>Rezultat: {m.home_score} - {m.away_score}</ThemedText>
                  ) : null}
                </ThemedView>
              ))
            )}
          </Section>

          <Section title="Gostujuce utakmice">
            {awayMatches.length === 0 ? (
              <ThemedText>Nema zakazanih gostujucih utakmica.</ThemedText>
            ) : (
              awayMatches.map((m) => (
                <ThemedView key={m.id} style={styles.matchRow}>
                  <ThemedText type="defaultSemiBold">
                    @ {m.home_club_name ?? `#${m.home_club_id}`}
                  </ThemedText>
                  <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
                  {m.venue ? <ThemedText>Mesto: {m.venue}</ThemedText> : null}
                  <ThemedText>Status: {m.status}</ThemedText>
                  {m.home_score !== null && m.away_score !== null ? (
                    <ThemedText>Rezultat: {m.home_score} - {m.away_score}</ThemedText>
                  ) : null}
                </ThemedView>
              ))
            )}
          </Section>
        </>
      ) : null}
    </ScrollView>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <ThemedView style={styles.sectionCard}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedView style={styles.sectionBody}>{children}</ThemedView>
    </ThemedView>
  );
}

type TabButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function TabButton({ label, active, onPress }: TabButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <ThemedText style={active ? styles.tabButtonActiveText : undefined}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 16,
    paddingBottom: 32,
  },
  subtitle: {
    opacity: 0.85,
  },
  subsectionTitle: {
    marginTop: 8,
  },
  link: {
    textDecorationLine: 'underline',
    fontSize: 16,
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  refreshButtonText: {
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabButtonActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  tabButtonActiveText: {
    color: '#fff',
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  sectionBody: {
    gap: 6,
  },
  matchRow: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 6,
    padding: 8,
    gap: 4,
  },
  errorText: {
    color: '#c53939',
  },
});
