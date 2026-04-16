import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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

type PlayerTabKey = 'attendance' | 'fees' | 'stats' | 'tactics';

export default function IgracHomeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [tactics, setTactics] = useState<TacticRow[]>([]);
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

    const [attendanceRes, feesRes, statsRes, membershipsRes] = await Promise.all([
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
    ]);

    if (attendanceRes.error || feesRes.error || statsRes.error || membershipsRes.error) {
      setErrorMessage(
        attendanceRes.error?.message ||
          feesRes.error?.message ||
          statsRes.error?.message ||
          membershipsRes.error?.message ||
          'Greska pri ucitavanju podataka igraca.'
      );
      setLoading(false);
      return;
    }

    const clubIds = (membershipsRes.data ?? []).map((membership) => membership.club_id);
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

    setAttendance(attendanceRes.data ?? []);
    setFees(feesRes.data ?? []);
    setStats(statsRes.data ?? []);
    setTactics(tacticsRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlayerData();
  }, [loadPlayerData]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Igrac Dashboard</ThemedText>
      <ThemedText style={styles.subtitle}>
        Read-only pregled: prisustvo, clanarina, statistika i taktike tvog kluba.
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
        <TabButton
          label="Prisustvo"
          active={activeTab === 'attendance'}
          onPress={() => setActiveTab('attendance')}
        />
        <TabButton label="Clanarina" active={activeTab === 'fees'} onPress={() => setActiveTab('fees')} />
        <TabButton label="Statistika" active={activeTab === 'stats'} onPress={() => setActiveTab('stats')} />
        <TabButton label="Taktike" active={activeTab === 'tactics'} onPress={() => setActiveTab('tactics')} />
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
    </ScrollView>
  );
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
  errorText: {
    color: '#c53939',
  },
});
