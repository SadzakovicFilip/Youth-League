import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { usePathname } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemeProfileToggle } from '@/components/theme-profile-toggle';
import { ThemedText } from '@/components/themed-text';
import { useAppDrawer } from '@/contexts/app-drawer-context';
import { useAppTheme } from '@/contexts/app-theme-context';
import { getAppRoleFromPathname } from '@/lib/resolve-profile-href';
import { personDisplayName } from '@/lib/person-display-name';
import { supabase } from '@/lib/supabase';

type ProfileRow = {
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
};

const fontHeadline = Platform.select({
  ios: 'AvenirNext-Bold' as const,
  android: 'sans-serif-condensed' as const,
  default: undefined,
});
const fontAccent = Platform.select({
  ios: 'AvenirNext-DemiBold' as const,
  android: 'sans-serif-medium' as const,
  default: undefined,
});
const fontBody = Platform.select({
  ios: 'AvenirNext-Regular' as const,
  android: 'sans-serif' as const,
  default: undefined,
});

function roleLabelSr(role: string | null): string {
  if (!role) return 'Aplikacija';
  const key = role.toLowerCase();
  const map: Record<string, string> = {
    trener: 'Trener',
    klub: 'Klub',
    savez: 'Savez',
    delegat: 'Delegat',
    igrac: 'Igrač',
    sudija: 'Sudija',
    zapisnicar: 'Zapisničar',
    admin: 'Administrator',
    scout: 'Skaut',
    spectator: 'Gledalac',
  };
  return map[key] ?? role;
}

function dash(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  return s.length > 0 ? s : '—';
}

function formatBirthSr(raw: string | null): string {
  if (!raw?.trim()) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw.trim();
    return d.toLocaleDateString('sr-Latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return raw.trim();
  }
}

function ProfileField({
  icon,
  label,
  value,
  colors,
}: {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={[styles.fieldIconWrap, { backgroundColor: colors.accentMuted }]}>
        <MaterialIcons name={icon} size={24} color={colors.tint} />
      </View>
      <View style={styles.fieldTextCol}>
        <ThemedText
          style={[
            styles.fieldLabel,
            { color: colors.textSecondary, fontFamily: fontAccent },
          ]}>
          {label}
        </ThemedText>
        <ThemedText
          style={[styles.fieldValue, { color: colors.text, fontFamily: fontBody }]}
          numberOfLines={6}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

export function AppDrawerProfilePanel({ open }: { open: boolean }) {
  const pathname = usePathname();
  const { colors } = useAppTheme();
  const { closeDrawer } = useAppDrawer();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setErrorMessage('');
      setProfile(null);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (userErr || !user) {
        setErrorMessage('Nema aktivne sesije.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, first_name, last_name, birth_date, address, phone')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;
      setLoading(false);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const row = data as ProfileRow | null;
      setProfile(
        row ?? {
          username: null,
          display_name: null,
          first_name: null,
          last_name: null,
          birth_date: null,
          address: null,
          phone: null,
        },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const roleLabel = roleLabelSr(getAppRoleFromPathname(pathname));
  const displayTitle = profile ? personDisplayName(profile) : null;

  return (
    <View style={styles.page}>
      <View style={styles.headerSection}>
        <View style={styles.closeRow}>
          <Pressable
            onPress={closeDrawer}
            style={({ pressed }) => [styles.closePress, pressed && { opacity: 0.65 }]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Zatvori meni">
            <MaterialIcons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.heroRow}>
          <MaterialIcons name="sports-basketball" size={40} color={colors.tint} />
          <View style={styles.heroText}>
            <ThemedText
              style={[styles.heroTitle, { color: colors.text, fontFamily: fontHeadline }]}>
              Moj nalog
            </ThemedText>
            {displayTitle ? (
              <ThemedText
                numberOfLines={2}
                style={[styles.heroSubtitle, { color: colors.textSecondary, fontFamily: fontBody }]}>
                {displayTitle}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </View>

      <View
        style={[
          styles.topBar,
          {
            borderBottomColor: colors.border,
          },
        ]}>
        <View style={[styles.rolePill, { backgroundColor: colors.tint }]}>
          <ThemedText
            numberOfLines={1}
            style={[styles.rolePillText, { fontFamily: fontAccent }]}>
            {roleLabel}
          </ThemedText>
        </View>
        <ThemeProfileToggle variant="inline" />
      </View>

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : errorMessage ? (
        <View style={styles.centerBlock}>
          <ThemedText
            style={[
              styles.errorText,
              { color: colors.danger, fontFamily: fontBody },
            ]}>
            {errorMessage}
          </ThemedText>
        </View>
      ) : profile ? (
        <View style={styles.fieldsScroll}>
          <ProfileField
            icon="badge"
            label="Prikazno ime"
            value={dash(profile.display_name)}
            colors={colors}
          />
          <ProfileField
            icon="account-circle"
            label="Korisničko ime"
            value={dash(profile.username)}
            colors={colors}
          />
          <ProfileField icon="person" label="Ime" value={dash(profile.first_name)} colors={colors} />
          <ProfileField
            icon="person-outline"
            label="Prezime"
            value={dash(profile.last_name)}
            colors={colors}
          />
          <ProfileField
            icon="cake"
            label="Datum rođenja"
            value={formatBirthSr(profile.birth_date)}
            colors={colors}
          />
          <ProfileField icon="home" label="Adresa" value={dash(profile.address)} colors={colors} />
          <ProfileField icon="phone" label="Telefon" value={dash(profile.phone)} colors={colors} />
        </View>
      ) : (
        <View style={styles.centerBlock}>
          <ThemedText style={{ color: colors.textSecondary, fontSize: 16, fontFamily: fontBody }}>
            Nema podataka o profilu u bazi.
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  headerSection: {
    width: '100%',
    marginBottom: 18,
  },
  closeRow: {
    alignSelf: 'flex-start',
    marginLeft: 3,
    marginBottom: 12,
  },
  closePress: {
    padding: 2,
    marginTop: -2,
  },
  heroRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  heroSubtitle: {
    fontSize: 17,
    lineHeight: 24,
  },
  topBar: {
    width: '100%',
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 16,
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rolePill: {
    flexShrink: 1,
    maxWidth: '52%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  rolePillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  fieldsScroll: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    gap: 22,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    width: '100%',
  },
  fieldIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldTextCol: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    justifyContent: 'center',
    gap: 0,
    paddingTop: 0,
  },
  fieldLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.85,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 1,
  },
  centerBlock: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
