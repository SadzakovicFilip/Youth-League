import type { BottomTabHeaderProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

import { AppChromeHeader } from '@/components/app-chrome-header';
import { useHeaderTitleOverrideOptional } from '@/contexts/header-title-override-context';
import { Colors } from '@/constants/theme';

type ColorSet = (typeof Colors)['light'] | (typeof Colors)['dark'];

export type TabChromeOptions = {
  /** Na ovim rutama (npr. `index`, `matches`) u sredini headera prikazuje se naslov taba umesto imena korisnika. */
  centerTitleForRoutes?: ReadonlySet<string>;
};

function TabScreenHeader(
  props: BottomTabHeaderProps & { centerRouteNames?: ReadonlySet<string> },
) {
  const override = useHeaderTitleOverrideOptional();
  const useCenter =
    props.centerRouteNames?.has(props.route.name) === true &&
    typeof props.options.title === 'string' &&
    props.options.title.length > 0;
  const tabTitle = useCenter && props.options.title ? String(props.options.title) : undefined;
  const centerTitle =
    override?.title && override.title.trim().length > 0 ? override.title.trim() : tabTitle;
  return <AppChromeHeader centerTitle={centerTitle} />;
}

/** Zajednički header + tab bar stil za uloge sa Tabs navigatorom. */
export function tabNavigatorChromeOptions(
  c: ColorSet,
  opts?: TabChromeOptions,
): BottomTabNavigationOptions {
  const centerRoutes = opts?.centerTitleForRoutes;
  return {
    headerShown: true,
    header: (props: BottomTabHeaderProps) => (
      <TabScreenHeader {...props} centerRouteNames={centerRoutes} />
    ),
    /** Omotač scene u tabu — bez ovoga često ostaje podrazumevana svetla pozadina. */
    sceneStyle: { backgroundColor: c.background },
    tabBarActiveTintColor: c.tint,
    tabBarInactiveTintColor: c.tabIconDefault,
    tabBarStyle: {
      backgroundColor: c.tabBar,
      borderTopColor: c.tabBarBorder,
    },
  };
}
