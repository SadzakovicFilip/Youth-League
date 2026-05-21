import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, usePathname } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SavezBreadcrumbs } from "@/components/savez/savez-breadcrumbs";
import { ThemedText } from "@/components/themed-text";
import { ActionAccentHex } from "@/constants/theme";
import { useAppTheme } from "@/contexts/app-theme-context";
import { hideSavezMainTabChrome } from "@/lib/chrome-left-mode";
import { useTakmicenjeDrillChrome } from "@/contexts/takmicenje-drill-chrome-context";

/** Jedan red: naslov ~26px linija; chevron usklađen visinom i centrom. */
const TITLE_ROW_MIN_HEIGHT = 42;
/** Chevron u proporciji sa naslovom (ThemedText ~26). */
const CHEVRON_SIZE = 28;
const SIDE_SLOT_WIDTH = 44;

export function TakmicenjeDrillChromeBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const drillCtx = useTakmicenjeDrillChrome();
  const setChrome = drillCtx?.setChrome;
  const normalized = pathname.replace(/\/$/, "") || "";
  const showShell = hideSavezMainTabChrome(normalized);

  useEffect(() => {
    if (!showShell) setChrome?.(null);
  }, [showShell, setChrome]);

  if (!showShell) return null;

  const title = drillCtx?.chrome?.title?.trim() || "…";
  const items = drillCtx?.chrome?.items ?? [];

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top - 16,
          paddingBottom: 4,
          backgroundColor: colors.backgroundElevated,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.sideSlot}
          accessibilityRole="button"
          accessibilityLabel="Nazad"
        >
          <MaterialIcons
            name="chevron-left"
            size={CHEVRON_SIZE}
            color={ActionAccentHex}
          />
        </Pressable>
        <View style={styles.titleCenter} pointerEvents="none">
          <ThemedText
            type="defaultSemiBold"
            numberOfLines={1}
            style={[styles.titleText, { color: colors.text }]}
          >
            {title}
          </ThemedText>
        </View>
        <View style={[styles.sideSlot, styles.sideSlotSpacer]} />
      </View>
      {items.length > 0 ? (
        <View style={styles.breadRow}>
          <SavezBreadcrumbs items={items} variant="drill" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: TITLE_ROW_MIN_HEIGHT,
    paddingHorizontal: 4,
  },
  sideSlot: {
    width: SIDE_SLOT_WIDTH,
    minHeight: TITLE_ROW_MIN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  /** Desni placeholder iste širine kao levi slot da naslov ostane centriran. */
  sideSlotSpacer: {
    pointerEvents: "none",
  },
  titleCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    paddingHorizontal: 2,
    minHeight: TITLE_ROW_MIN_HEIGHT,
  },
  titleText: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 0.12,
    textAlign: "center",
    lineHeight: 30,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  breadRow: {
    paddingHorizontal: 8,
    paddingTop: 0,
  },
});
