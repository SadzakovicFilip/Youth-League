import type { BreadcrumbItem } from '@/components/savez/savez-breadcrumbs';
import {
  LeagueCompetitionView,
  type LeagueCompetitionViewHandle,
} from '@/components/shared/league-competition-view';
import { useSyncTakmicenjeDrillChrome } from '@/contexts/takmicenje-drill-chrome-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

export default function LigaTakmicenjeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leagueId = Number(id);
  const [trail, setTrail] = useState<{
    leagueName: string;
    regionId: number | null;
    regionName: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Number.isFinite(leagueId)) return;
      const { data: le } = await supabase.from('leagues').select('name, region_id').eq('id', leagueId).maybeSingle();
      if (cancelled || !le) return;
      let regionName: string | null = null;
      const rid = le.region_id as number | null;
      if (rid != null) {
        const { data: reg } = await supabase.from('regions').select('name').eq('id', rid).maybeSingle();
        regionName = (reg?.name as string | undefined) ?? null;
      }
      setTrail({ leagueName: le.name as string, regionId: rid, regionName });
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const chromeTitle = 'Takmičenje';
  const chromeItems = useMemo<BreadcrumbItem[]>(
    () => [
      { label: 'Regije', path: '/savez' },
      ...(trail?.regionId != null
        ? [{ label: trail.regionName ?? `Regija #${trail.regionId}`, path: `/savez/regija/${trail.regionId}` }]
        : []),
      { label: trail?.leagueName ?? 'Liga', path: `/savez/liga/${leagueId}` },
      { label: chromeTitle },
    ],
    [chromeTitle, leagueId, trail?.leagueName, trail?.regionId, trail?.regionName],
  );
  useSyncTakmicenjeDrillChrome(true, chromeTitle, chromeItems);

  const compRef = useRef<LeagueCompetitionViewHandle>(null);
  useScreenPullRefresh(
    useCallback(() => compRef.current?.refresh() ?? Promise.resolve(), []),
  );

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      <LeagueCompetitionView
        ref={compRef}
        leagueId={leagueId}
        onOpenPlayer={(uid, cid) =>
          router.push(
            `/savez/korisnik/${uid}${cid != null ? `?clubId=${cid}` : ''}` as never,
          )
        }
        onOpenClub={(cid) => router.push(`/savez/klub/${cid}`)}
      />
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 32 },
});
