import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { LeagueCompetitionView } from '@/components/shared/league-competition-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserDetailView } from '@/components/shared/user-detail-view';
import { supabase } from '@/lib/supabase';

type AttendanceRow = {
  id: number;
  scheduled_at: string;
  topic: string;
  venue: string | null;
  present: boolean;
  marked: boolean;
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

type TacticActionRow = {
  id: number;
  name: string;
  description: string | null;
  position: number;
};

type TacticRow = {
  id: number;
  name: string;
  kind: 'attack' | 'defense';
  description: string | null;
  actions: TacticActionRow[];
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

type HubUpcoming = {
  id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_club_id: number;
  away_club_id: number;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  side: 'home' | 'away';
};

type HubPlayed = {
  match_id: number;
  scheduled_at: string;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  side: 'home' | 'away';
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  total_points: number;
  result: string;
};

type HubAgg = {
  games_played: number;
  total_points: number;
  avg_points: number;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  pct_points_ft: number;
  pct_points_2: number;
  pct_points_3: number;
};

type MatchHubPayload = {
  club_id: number | null;
  league_id: number | null;
  league_name: string | null;
  upcoming: HubUpcoming[];
  played: HubPlayed[];
  season: HubAgg;
  career: HubAgg;
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
  const [matchHub, setMatchHub] = useState<MatchHubPayload | null>(null);
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

    // Jedan RPC poziv umesto 7 (F24 konsolidacija)
    const { data: dash, error: dashErr } = await supabase.rpc('get_igrac_dashboard');
    if (dashErr) {
      setErrorMessage(dashErr.message);
      setLoading(false);
      return;
    }

    const payload = (dash ?? {}) as {
      club_context: ClubContext | null;
      trainings: AttendanceRow[];
      fees: FeeRow[];
      stats: StatRow[];
      tactics: TacticRow[];
      group_clubs: GroupClub[];
      match_hub: MatchHubPayload | null;
    };

    setClubContext(payload.club_context ?? null);
    setAttendance(payload.trainings ?? []);
    setFees(payload.fees ?? []);
    setStats(payload.stats ?? []);
    setTactics(payload.tactics ?? []);
    setGroupClubs(payload.group_clubs ?? []);
    setMatchHub(payload.match_hub ?? null);
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
        <Section title="Moje prisustvo treninzima">
          {attendance.length === 0 ? (
            <ThemedText>Nema zakazanih treninga.</ThemedText>
          ) : (
            attendance.map((row) => (
              <ThemedView key={row.id} style={styles.attendanceCard}>
                <ThemedText type="defaultSemiBold">{row.topic}</ThemedText>
                <ThemedText>Termin: {formatDateTime(row.scheduled_at)}</ThemedText>
                {row.venue ? <ThemedText>Mesto: {row.venue}</ThemedText> : null}
                <ThemedText
                  style={[
                    styles.attendanceBadge,
                    row.present ? styles.attendancePresent : styles.attendanceAbsent,
                  ]}>
                  {row.present ? 'Prisustvovao' : row.marked ? 'Odsutan' : 'Nije zavedeno'}
                </ThemedText>
              </ThemedView>
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
            tactics.map((t) => (
              <ThemedView key={t.id} style={styles.tacticCard}>
                <ThemedView style={styles.tacticHeader}>
                  <ThemedText type="defaultSemiBold">{t.name}</ThemedText>
                  <ThemedText
                    style={[
                      styles.tacticKindBadge,
                      t.kind === 'attack' ? styles.tacticKindAttack : styles.tacticKindDefense,
                    ]}>
                    {t.kind === 'attack' ? 'Napad' : 'Odbrana'}
                  </ThemedText>
                </ThemedView>
                {t.description ? <ThemedText style={styles.muted}>{t.description}</ThemedText> : null}
                {t.actions.length === 0 ? (
                  <ThemedText style={styles.muted}>Nema akcija.</ThemedText>
                ) : (
                  t.actions.map((a) => (
                    <ThemedView key={a.id} style={styles.actionMini}>
                      <ThemedText type="defaultSemiBold">
                        {a.position}. {a.name}
                      </ThemedText>
                      {a.description ? <ThemedText>{a.description}</ThemedText> : null}
                    </ThemedView>
                  ))
                )}
              </ThemedView>
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
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/igrac/klub/${c.id}`)}
                    style={[styles.matchRow, c.id === clubContext.club_id && styles.cardMine]}>
                    <ThemedText type="defaultSemiBold">
                      {c.name}
                      {c.id === clubContext.club_id ? '  (tvoj klub)' : ''}
                    </ThemedText>
                    <ThemedText style={styles.openHint}>Otvori tim ▸</ThemedText>
                  </Pressable>
                ))
              )}

              {clubContext.league_id ? (
                <LeagueCompetitionView
                  leagueId={clubContext.league_id}
                  onOpenPlayer={(uid) => router.push(`/igrac/korisnik/${uid}`)}
                  onOpenClub={(cid) => router.push(`/igrac/klub/${cid}`)}
                />
              ) : null}
            </>
          )}
        </Section>
      ) : null}

      {activeTab === 'schedule' ? (
        <>
          {!matchHub || !matchHub.club_id ? (
            <Section title="Utakmice">
              <ThemedText>Nisi u klubu kao igrac ili nema podataka.</ThemedText>
            </Section>
          ) : (
            <>
              <Section title="Predstojece utakmice">
                {matchHub.upcoming.length === 0 ? (
                  <ThemedText>Nema predstojecih utakmica.</ThemedText>
                ) : (
                  matchHub.upcoming.map((m) => {
                    const opp =
                      m.side === 'home' ? (m.away_club_name ?? `#${m.away_club_id}`) : (m.home_club_name ?? `#${m.home_club_id}`);
                    const prefix = m.side === 'home' ? 'vs' : '@';
                    return (
                      <ThemedView key={m.id} style={styles.matchRow}>
                        <ThemedText type="defaultSemiBold">
                          {prefix} {opp}
                        </ThemedText>
                        <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
                        {m.venue ? <ThemedText>Mesto: {m.venue}</ThemedText> : null}
                        <ThemedText>Status: {m.status}</ThemedText>
                        {m.home_score != null && m.away_score != null ? (
                          <ThemedText>
                            Rezultat (uzivo): {m.home_score} - {m.away_score}
                          </ThemedText>
                        ) : null}
                      </ThemedView>
                    );
                  })
                )}
              </Section>

              <Section title="Odigrane utakmice (statistika sa terena)">
                {matchHub.played.length === 0 ? (
                  <ThemedText>Nema odigranih utakmica.</ThemedText>
                ) : (
                  matchHub.played.map((m) => {
                    const opp =
                      m.side === 'home' ? (m.away_club_name ?? '-') : (m.home_club_name ?? '-');
                    const prefix = m.side === 'home' ? 'vs' : '@';
                    return (
                      <ThemedView key={m.match_id} style={styles.matchRow}>
                        <ThemedText type="defaultSemiBold">
                          {formatDate(m.scheduled_at)} — {prefix} {opp} ({m.result})
                        </ThemedText>
                        <ThemedText>
                          Rezultat: {m.home_score ?? '-'} : {m.away_score ?? '-'}
                        </ThemedText>
                        <ThemedText>
                          Tvoji poeni: {m.total_points} (+1: {m.pts_ft}, +2: {m.pts_2}, +3: {m.pts_3})
                        </ThemedText>
                        <ThemedText>Licne greske: {m.fouls}</ThemedText>
                      </ThemedView>
                    );
                  })
                )}
              </Section>

              <Section title="SEZONA">
                <ThemedText>Meceva: {matchHub.season.games_played}</ThemedText>
                <ThemedText>Ukupno poena: {matchHub.season.total_points}</ThemedText>
                <ThemedText>Prosek po mecu: {matchHub.season.avg_points}</ThemedText>
                <ThemedText>
                  +1 / +2 / +3 (broj): {matchHub.season.pts_ft} / {matchHub.season.pts_2} / {matchHub.season.pts_3}
                </ThemedText>
                <ThemedText>Licne greske (ukupno): {matchHub.season.fouls}</ThemedText>
                <ThemedText>
                  Procenat poena iz +1: {matchHub.season.pct_points_ft}% · iz +2: {matchHub.season.pct_points_2}% · iz +3:{' '}
                  {matchHub.season.pct_points_3}%
                </ThemedText>
              </Section>

              <Section title="Karijera (svi zavrseni mecevi u klubu)">
                <ThemedText>Meceva: {matchHub.career.games_played}</ThemedText>
                <ThemedText>Ukupno poena: {matchHub.career.total_points}</ThemedText>
                <ThemedText>Prosek po mecu: {matchHub.career.avg_points}</ThemedText>
                <ThemedText>
                  +1 / +2 / +3 (broj): {matchHub.career.pts_ft} / {matchHub.career.pts_2} / {matchHub.career.pts_3}
                </ThemedText>
                <ThemedText>Licne greske (ukupno): {matchHub.career.fouls}</ThemedText>
                <ThemedText>
                  Procenat poena iz +1: {matchHub.career.pct_points_ft}% · iz +2: {matchHub.career.pct_points_2}% · iz +3:{' '}
                  {matchHub.career.pct_points_3}%
                </ThemedText>
              </Section>
            </>
          )}
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

function formatDateTime(iso: string | null | undefined) {
  return formatDate(iso);
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
  cardMine: {
    borderColor: '#0a7ea4',
    backgroundColor: '#eaf4f8',
  },
  openHint: {
    color: '#0a7ea4',
    fontWeight: '600',
    fontSize: 12,
  },
  errorText: {
    color: '#c53939',
  },
  attendanceCard: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 6,
    padding: 10,
    gap: 2,
  },
  attendanceBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
  },
  attendancePresent: { backgroundColor: '#0a7ea4', color: '#fff' },
  attendanceAbsent: { backgroundColor: '#eee', color: '#666' },
  tacticCard: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  tacticHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tacticKindBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
  },
  tacticKindAttack: { backgroundColor: '#0a7ea4', color: '#fff' },
  tacticKindDefense: { backgroundColor: '#c53939', color: '#fff' },
  actionMini: {
    borderLeftWidth: 3,
    borderLeftColor: '#0a7ea4',
    paddingLeft: 8,
    paddingVertical: 2,
  },
  muted: { color: '#888', fontStyle: 'italic' },
});
