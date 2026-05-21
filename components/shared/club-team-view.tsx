import { ActionAccentHex } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useSyncTakmicenjeDrillChrome } from '@/contexts/takmicenje-drill-chrome-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, router, usePathname, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import type { BreadcrumbItem } from '@/components/savez/savez-breadcrumbs';
import {
  MatchRichCard,
  formatScore,
  playedOutcomeLetter,
  type MatchRichTheme,
} from '@/components/shared/match-rich-card';
import { useClubPublicMatches } from '@/components/shared/club-public-matches-view';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { mapRpcClubContext, type ClubContext } from '@/lib/club-context';
import { licenseValidityFromMember } from '@/lib/license-valid-until';
import { matchDetailHrefFromPathname } from '@/lib/match-detail-href';
import { personDisplayName } from '@/lib/person-display-name';
import { overlayUserLicensesOnTeam } from '@/lib/team-license-overlay';
import { supabase } from '@/lib/supabase';

type TeamMember = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  fee_status?: string | null;
  fee_amount_due?: number | null;
  fee_amount_paid?: number | null;
  fee_period_month?: string | null;
  fee_due_date?: string | null;
  total_unpaid?: number | null;
  current_month_status?: string | null;
  current_month_due?: number | null;
  license_valid_until?: string | null;
  license_file_path?: string | null;
  license_number?: string | null;
};

type ClubTeamPayload = {
  context: {
    club_id: number;
    club_name: string;
    league_id: number | null;
    league_name: string | null;
    region_id: number | null;
    region_name: string | null;
    group_id: number | null;
    group_name: string | null;
    monthly_fee: number | null;
  } | null;
  players: TeamMember[];
  trainers: TeamMember[];
};

const GREEN_OK = '#2e7d32';
const RED_BAD = '#c62828';

type TeamTab = 'igraci' | 'treneri' | 'predstojece' | 'odigrane';

export type ClubTeamViewProps = {
  clubId: number;
  onOpenUser: (userId: string, clubId: number) => void;
  /** Kada je true (npr. savez drill), naslov i breadcrumbs idu u gornju traku. */
  syncDrillChrome?: boolean;
  /**
   * false za delegata / savez / tuđi tim — ne prikazuje se red članarine na kartici.
   */
  showMemberFees?: boolean;
  /**
   * false: ne prikazuje status licence na kartici člana (npr. klub gleda tuđi tim).
   */
  showLicenseRow?: boolean;
};

export function ClubTeamView({
  clubId,
  onOpenUser,
  syncDrillChrome = false,
  showMemberFees = true,
  showLicenseRow = true,
}: ClubTeamViewProps) {
  const { colors } = useAppTheme();
  const pathname = usePathname();
  const matchRichTheme = useMemo<MatchRichTheme>(
    () => ({
      surfaceMuted: colors.surfaceMuted,
      borderStrong: colors.borderStrong,
      tint: colors.tint,
      text: colors.text,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      danger: colors.danger,
    }),
    [colors],
  );

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [context, setContext] = useState<ClubContext | null>(null);
  const [monthlyFee, setMonthlyFee] = useState<number | null>(null);
  const [players, setPlayers] = useState<TeamMember[]>([]);
  const [trainers, setTrainers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<TeamTab>('igraci');

  const matches = useClubPublicMatches(clubId);
  const upcoming = matches.data?.upcoming ?? [];
  const played = matches.data?.played ?? [];

  const load = useCallback(async () => {
    if (!Number.isFinite(clubId)) {
      setErrorMessage('Nevažeći klub.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');

    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_klub_team_overview', {
      p_club_id: clubId,
    });

    if (rpcErr) {
      setErrorMessage(rpcErr.message);
      setContext(null);
      setPlayers([]);
      setTrainers([]);
      setMonthlyFee(null);
      setLoading(false);
      return;
    }

    const payload = rpcData as ClubTeamPayload;
    const mappedCtx = mapRpcClubContext(payload.context as never);
    if (mappedCtx) setContext(mappedCtx);
    else setContext(null);
    setMonthlyFee(payload.context?.monthly_fee ?? null);

    const rpcPlayers = (payload.players ?? []) as TeamMember[];
    const rpcTrainers = (payload.trainers ?? []) as TeamMember[];
    const mergedAll = await overlayUserLicensesOnTeam([...rpcPlayers, ...rpcTrainers]);
    setPlayers(mergedAll.slice(0, rpcPlayers.length));
    setTrainers(mergedAll.slice(rpcPlayers.length));
    setLoading(false);
  }, [clubId]);

  const refreshAll = useCallback(async () => {
    await load();
    await matches.reload();
  }, [load, matches.reload]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll]),
  );

  useScreenPullRefresh(refreshAll);

  const chromeTitle = context?.clubName ?? 'Klub';
  const chromeItems = useMemo<BreadcrumbItem[]>(() => {
    if (!context) return [];
    const out: BreadcrumbItem[] = [{ label: 'Regije', path: '/savez' }];
    if (context.regionId != null) {
      out.push({
        label: context.regionName ?? `Regija #${context.regionId}`,
        path: `/savez/regija/${context.regionId}`,
      });
    }
    if (context.leagueId != null) {
      out.push({
        label: context.leagueName ?? `Liga #${context.leagueId}`,
        path: `/savez/liga/${context.leagueId}`,
      });
    }
    if (context.groupId != null) {
      out.push({
        label: context.groupName ?? `Grupa #${context.groupId}`,
        path: `/savez/grupa/${context.groupId}`,
      });
    }
    out.push({ label: context.clubName });
    return out;
  }, [context]);

  useSyncTakmicenjeDrillChrome(syncDrillChrome && Boolean(context), chromeTitle, chromeItems);

  const isPaid = (status?: string | null) => {
    if (!status) return false;
    return ['placeno', 'paid'].includes(status.toLowerCase());
  };

  const renderMemberCard = (member: TeamMember, showFees: boolean) => {
    const lic = showLicenseRow
      ? licenseValidityFromMember(member as unknown as Record<string, unknown>)
      : { ok: true, message: '' };
    const name = personDisplayName(member);

    let feePaid = true;
    let currentDue = 0;
    if (showFees && showMemberFees) {
      currentDue = Number(member.current_month_due ?? monthlyFee ?? 0);
      const statusPaid = isPaid(member.current_month_status ?? member.fee_status);
      feePaid = statusPaid || currentDue <= 0;
    }

    return (
      <ThemedView key={member.user_id} style={styles.card}>
        <Pressable
          onPress={() => onOpenUser(member.user_id, clubId)}
          style={styles.summaryPress}
          accessibilityRole="link"
          accessibilityLabel={`Profil: ${name}`}>
          <View style={styles.summaryInner}>
            <View style={styles.summaryRows}>
              <View style={styles.summaryRow}>
                <MaterialIcons name="person" size={24} color={ActionAccentHex} />
                <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.summaryNameFlex}>
                  {name}
                </ThemedText>
              </View>
              {showFees && showMemberFees ? (
                <View style={styles.summaryRow}>
                  <MaterialIcons name="attach-money" size={22} color={ActionAccentHex} />
                  <View style={styles.summaryStatusFlex}>
                    {feePaid ? (
                      <MaterialIcons name="check-circle" size={20} color={GREEN_OK} />
                    ) : (
                      <ThemedText style={styles.summaryDebtText}>dug: {currentDue}</ThemedText>
                    )}
                  </View>
                </View>
              ) : null}
              {showLicenseRow ? (
                <View style={styles.summaryRow}>
                  <MaterialIcons name="badge" size={22} color={ActionAccentHex} />
                  <View style={styles.summaryStatusFlex}>
                    {lic.ok ? (
                      <MaterialIcons name="check-circle" size={20} color={GREEN_OK} />
                    ) : (
                      <ThemedText style={styles.summaryDebtText}>{lic.message}</ThemedText>
                    )}
                  </View>
                </View>
              ) : null}
            </View>
            <MaterialIcons name="chevron-right" size={24} color={ActionAccentHex} style={styles.summaryChevron} />
          </View>
        </Pressable>
      </ThemedView>
    );
  };

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      {!syncDrillChrome ? (
        <>
          {context ? (
            <ThemedView style={styles.headerCard}>
              <ThemedText type="title">{context.clubName}</ThemedText>
              {context.leagueName ? <ThemedText>Liga: {context.leagueName}</ThemedText> : null}
              {context.groupName ? <ThemedText>Grupa: {context.groupName}</ThemedText> : null}
              {context.regionName ? <ThemedText>Regija: {context.regionName}</ThemedText> : null}
            </ThemedView>
          ) : null}
        </>
      ) : null}

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage ? (
        <>
          <View style={styles.chipRow}>
            <Pressable
              style={[
                styles.chipFilled,
                {
                  backgroundColor: activeTab === 'igraci' ? ActionAccentHex : colors.surfaceMuted,
                  borderColor: activeTab === 'igraci' ? ActionAccentHex : colors.borderStrong,
                },
              ]}
              onPress={() => setActiveTab('igraci')}>
              <ThemedText
                type="defaultSemiBold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                  color: activeTab === 'igraci' ? '#fff' : colors.text,
                  fontSize: 11,
                  letterSpacing: 0.15,
                  textAlign: 'center',
                }}>
                Igrači
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.chipFilled,
                {
                  backgroundColor: activeTab === 'treneri' ? ActionAccentHex : colors.surfaceMuted,
                  borderColor: activeTab === 'treneri' ? ActionAccentHex : colors.borderStrong,
                },
              ]}
              onPress={() => setActiveTab('treneri')}>
              <ThemedText
                type="defaultSemiBold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                  color: activeTab === 'treneri' ? '#fff' : colors.text,
                  fontSize: 11,
                  letterSpacing: 0.15,
                  textAlign: 'center',
                }}>
                Treneri
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.chipFilled,
                {
                  backgroundColor: activeTab === 'predstojece' ? ActionAccentHex : colors.surfaceMuted,
                  borderColor: activeTab === 'predstojece' ? ActionAccentHex : colors.borderStrong,
                },
              ]}
              onPress={() => setActiveTab('predstojece')}>
              <ThemedText
                type="defaultSemiBold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                  color: activeTab === 'predstojece' ? '#fff' : colors.text,
                  fontSize: 11,
                  letterSpacing: 0.15,
                  textAlign: 'center',
                }}>
                Predstojeće
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.chipFilled,
                {
                  backgroundColor: activeTab === 'odigrane' ? ActionAccentHex : colors.surfaceMuted,
                  borderColor: activeTab === 'odigrane' ? ActionAccentHex : colors.borderStrong,
                },
              ]}
              onPress={() => setActiveTab('odigrane')}>
              <ThemedText
                type="defaultSemiBold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                  color: activeTab === 'odigrane' ? '#fff' : colors.text,
                  fontSize: 11,
                  letterSpacing: 0.15,
                  textAlign: 'center',
                }}>
                Odigrane
              </ThemedText>
            </Pressable>
          </View>

          {activeTab === 'igraci' && players.length === 0 ? (
            <ThemedText>Nema igrača za prikaz.</ThemedText>
          ) : null}
          {activeTab === 'treneri' && trainers.length === 0 ? (
            <ThemedText>Nema trenera za prikaz.</ThemedText>
          ) : null}

          {activeTab === 'igraci' ? players.map((p) => renderMemberCard(p, true)) : null}
          {activeTab === 'treneri' ? trainers.map((t) => renderMemberCard(t, false)) : null}

          {activeTab === 'predstojece' ? (
            <>
              {matches.loading ? <ActivityIndicator /> : null}
              {matches.errorMessage ? (
                <ThemedView style={styles.card}>
                  <ThemedText style={styles.errorText}>{matches.errorMessage}</ThemedText>
                </ThemedView>
              ) : null}
              {!matches.loading && !matches.errorMessage && upcoming.length === 0 ? (
                <ThemedText style={styles.muted}>Nema zakazanih utakmica.</ThemedText>
              ) : null}
              {!matches.loading && !matches.errorMessage
                ? upcoming.map((m) => {
                    const opp =
                      m.side === 'home'
                        ? (m.away_club_name ?? `#${m.away_club_id}`)
                        : (m.home_club_name ?? `#${m.home_club_id}`);
                    return (
                      <MatchRichCard
                        key={m.id}
                        variant="club_upcoming"
                        theme={matchRichTheme}
                        oppName={opp}
                        scheduledIso={m.scheduled_at}
                        venue={m.venue}
                        status={m.status}
                        homeScore={m.home_score}
                        awayScore={m.away_score}
                      />
                    );
                  })
                : null}
            </>
          ) : null}

          {activeTab === 'odigrane' ? (
            <>
              {matches.loading ? <ActivityIndicator /> : null}
              {matches.errorMessage ? (
                <ThemedView style={styles.card}>
                  <ThemedText style={styles.errorText}>{matches.errorMessage}</ThemedText>
                </ThemedView>
              ) : null}
              {!matches.loading && !matches.errorMessage && played.length === 0 ? (
                <ThemedText style={styles.muted}>Nema odigranih utakmica.</ThemedText>
              ) : null}
              {!matches.loading && !matches.errorMessage
                ? played.map((m) => {
                    const opp =
                      m.side === 'home'
                        ? (m.away_club_name ?? `#${m.away_club_id}`)
                        : (m.home_club_name ?? `#${m.home_club_id}`);
                    const scoreLine = formatScore(m.home_score, m.away_score);
                    const outcome = playedOutcomeLetter(m.side, m.home_score, m.away_score, m.result);
                    const href = matchDetailHrefFromPathname(pathname, m.id);
                    return (
                      <MatchRichCard
                        key={m.id}
                        variant="club_played"
                        theme={matchRichTheme}
                        oppName={opp}
                        scheduledIso={m.scheduled_at}
                        scoreLine={scoreLine}
                        outcome={outcome}
                        onPress={href ? () => router.push(href as Href) : undefined}
                      />
                    );
                  })
                : null}
            </>
          ) : null}
        </>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  headerCard: { gap: 4, marginBottom: 4 },
  card: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  summaryPress: { borderRadius: 6 },
  summaryInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  summaryRows: { flex: 1, gap: 8, minWidth: 0 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryNameFlex: { flex: 1, minWidth: 0, fontSize: 16 },
  summaryStatusFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  summaryDebtText: {
    color: RED_BAD,
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  summaryChevron: { marginTop: 0, flexShrink: 0 },
  errorText: { color: '#c53939' },
  muted: { color: '#888', fontStyle: 'italic' },
  chipRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
  },
  chipFilled: {
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
});
