import { useAppTheme } from '@/contexts/app-theme-context';
import { useScreenPullRefreshContext } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

type Props = ScrollViewProps & {
  /** Ako je prosleđeno, koristi se umesto handlera registrovanog preko useScreenPullRefresh. */
  onRefresh?: () => void | Promise<void>;
  /**
   * iOS: pomeranje `contentInset` kada je tastatura otvorena (često bolje od ugnježdenog KAV + ScrollView).
   */
  automaticallyAdjustKeyboardInsets?: boolean;
};

/**
 * ScrollView sa pull-to-refresh (povlačenje sadržaja nadole).
 * Poziva `onRefresh` ako je prosleđen, inače handler trenutno fokusiranog ekrana (`useScreenPullRefresh`).
 * Ako nema handlera, gest se završi bez dodatnog posla (samo animacija osvežavanja).
 */
export function RefreshableScrollView({
  onRefresh: onRefreshProp,
  children,
  automaticallyAdjustKeyboardInsets,
  ...rest
}: Props) {
  const { colors } = useAppTheme();
  const { handlerRef } = useScreenPullRefreshContext();
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async () => {
    const fn = onRefreshProp ?? handlerRef.current;
    setRefreshing(true);
    try {
      if (fn) await Promise.resolve(fn());
    } finally {
      setRefreshing(false);
    }
  }, [handlerRef, onRefreshProp]);

  return (
    <ScrollView
      {...rest}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets ?? false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={run}
          tintColor={colors.tint}
          colors={[colors.tint]}
        />
      }>
      {children}
    </ScrollView>
  );
}
