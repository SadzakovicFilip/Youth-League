import { router } from 'expo-router';

import { LeagueCompetitionView } from '@/components/shared/league-competition-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useIgracDashboard } from '@/contexts/igrac-dashboard-context';

import { IgracScreenState } from './igrac-screen-state';

export function IgracLigaContent() {
  const { colors } = useAppTheme();
  const { loading, errorMessage, data } = useIgracDashboard();
  const clubContext = data?.club_context ?? null;

  return (
    <>
      <IgracScreenState loading={loading} errorMessage={errorMessage} />

      {!loading && !errorMessage ? (
        !clubContext?.league_id ? (
          <ThemedView style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, padding: 12 }}>
            <ThemedText style={{ color: colors.textSecondary }}>
              {!clubContext ? 'Nisi raspoređen ni u jedan klub.' : 'Klub još nije dodeljen ligi.'}
            </ThemedText>
          </ThemedView>
        ) : (
          <LeagueCompetitionView
            leagueId={clubContext.league_id}
            highlightClubId={clubContext.club_id}
            onOpenPlayer={(uid, cid) =>
              router.push(
                `/igrac/korisnik/${uid}${cid != null ? `?clubId=${cid}` : ''}` as never,
              )
            }
            onOpenClub={(cid) => router.push(`/igrac/klub/${cid}` as never)}
          />
        )
      ) : null}
    </>
  );
}
