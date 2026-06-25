import { ActionAccentHex } from "@/constants/theme";
import * as DocumentPicker from "expo-document-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { LicenseValidUntilField } from "@/components/license-valid-until-field";
import { ConfirmRemoveIconButton } from "@/components/confirm-remove-icon-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedView } from "@/components/themed-view";
import { sanitizeUsername } from "@/lib/auth";
import {
  pickLicensePdf,
  saveUserLicense,
  uploadLicensePdf,
} from "@/lib/license-upload";
import { supabase } from "@/lib/supabase";

type League = { id: number; name: string; region_id: number | null };
type Group = { id: number; league_id: number; name: string };
type Sudija = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export default function DelegatLigaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leagueId = Number(id);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [league, setLeague] = useState<League | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sudije, setSudije] = useState<Sudija[]>([]);

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  // add sudija form
  const [showForm, setShowForm] = useState(false);
  const [sUsername, setSUsername] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [sFirstName, setSFirstName] = useState("");
  const [sLastName, setSLastName] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sLicenseNumber, setSLicenseNumber] = useState("");
  const [sLicenseValidUntil, setSLicenseValidUntil] = useState("");
  const [sPickedFile, setSPickedFile] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(leagueId)) {
      setErrorMessage("Nevazeca liga.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage("");

    const [lRes, gRes, sRes] = await Promise.all([
      supabase
        .from("leagues")
        .select("id, name, region_id")
        .eq("id", leagueId)
        .maybeSingle(),
      supabase
        .from("league_groups")
        .select("id, league_id, name")
        .eq("league_id", leagueId)
        .order("name"),
      supabase.rpc("get_league_sudije", { p_league_id: leagueId }),
    ]);

    if (lRes.error || gRes.error || sRes.error) {
      setErrorMessage(
        lRes.error?.message ||
          gRes.error?.message ||
          sRes.error?.message ||
          "Greska pri ucitavanju.",
      );
      setLoading(false);
      return;
    }

    setLeague((lRes.data ?? null) as League | null);
    setGroups((gRes.data ?? []) as Group[]);
    setSudije(((sRes.data ?? []) as Sudija[]) || []);
    setLoading(false);
  }, [leagueId]);

  const onCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setErrorMessage("Naziv grupe je obavezan.");
      return;
    }
    setGroupSubmitting(true);
    setErrorMessage("");
    const { error } = await supabase.from("league_groups").insert({
      league_id: leagueId,
      name: newGroupName.trim(),
    });
    setGroupSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setNewGroupName("");
    setShowGroupForm(false);
    await load();
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onCreateSudija = async () => {
    if (!sUsername.trim() || !sPassword.trim()) {
      setErrorMessage("Username i password sudije su obavezni.");
      return;
    }
    const safeUsername = sanitizeUsername(sUsername);
    if (!safeUsername) {
      setErrorMessage("Username mora sadrzati slova/brojeve.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    const { data: created, error: fnErr } = await supabase.functions.invoke(
      "create-managed-user",
      {
        body: {
          role: "sudija",
          username: safeUsername,
          password: sPassword,
          display_name:
            [sFirstName, sLastName].filter(Boolean).join(" ") || safeUsername,
          first_name: sFirstName || undefined,
          last_name: sLastName || undefined,
          phone: sPhone || undefined,
        },
      },
    );

    if (fnErr) {
      let raw = "";
      try {
        const text = await fnErr.context?.text?.();
        raw = text ? ` | RAW: ${text}` : "";
      } catch {
        raw = "";
      }
      setErrorMessage(`Sudija: ${fnErr.message}${raw}`);
      setSubmitting(false);
      return;
    }

    const newUserId =
      (created as { user_id?: string; id?: string } | null)?.user_id ??
      (created as { user_id?: string; id?: string } | null)?.id ??
      null;

    if (!newUserId) {
      setErrorMessage("Sudija kreiran ali nije vracen user_id.");
      setSubmitting(false);
      return;
    }

    const { error: linkErr } = await supabase
      .from("league_sudije")
      .insert({ league_id: leagueId, user_id: newUserId });

    if (linkErr) {
      setErrorMessage(
        `Sudija kreiran, ali nije vezan za ligu: ${linkErr.message}`,
      );
      setSubmitting(false);
      return;
    }

    const trimmedNumber = sLicenseNumber.trim() || null;
    const trimmedValidUntil = sLicenseValidUntil.trim() || null;
    if (sPickedFile || trimmedNumber || trimmedValidUntil) {
      let licensePath: string | null = null;
      if (sPickedFile) {
        const { path, error: upErr } = await uploadLicensePdf(
          newUserId,
          sPickedFile,
        );
        if (upErr) {
          setErrorMessage(
            `Sudija kreiran, ali licenca nije snimljena: ${upErr}`,
          );
          setSubmitting(false);
          await load();
          return;
        }
        licensePath = path;
      }
      const { error: licErr } = await saveUserLicense({
        userId: newUserId,
        validUntil: trimmedValidUntil,
        licenseFilePath: licensePath,
        licenseNumber: trimmedNumber,
      });
      if (licErr) {
        setErrorMessage(
          `Sudija kreiran, ali licenca nije snimljena: ${licErr}`,
        );
        setSubmitting(false);
        await load();
        return;
      }
    }

    setSUsername("");
    setSPassword("");
    setSFirstName("");
    setSLastName("");
    setSPhone("");
    setSLicenseNumber("");
    setSLicenseValidUntil("");
    setSPickedFile(null);
    setShowForm(false);
    setSubmitting(false);
    await load();
  };

  const onPickSudijaPdf = async () => {
    const picked = await pickLicensePdf();
    if (picked) setSPickedFile(picked);
  };

  const onRemoveSudija = async (userId: string) => {
    const { error } = await supabase
      .from("league_sudije")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", userId);
    if (error) {
      setErrorMessage(`Uklanjanje sudije: ${error.message}`);
      return;
    }
    await load();
  };

  useScreenPullRefresh(load);

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.push('/delegat/takmicenje')}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">{league?.name ?? "Liga"}</ThemedText>
      <ThemedText>
        Dodavanje grupa i sudija. Raspored mečeva i takmičenje su na donjim tabovima (Upravljaj utakmicama /
        Takmičenje).
      </ThemedText>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {/* GRUPE */}
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Grupe ({groups.length})</ThemedText>
        <Pressable
          style={styles.smallButton}
          onPress={() => {
            if (showGroupForm) {
              setShowGroupForm(false);
              setNewGroupName("");
              setErrorMessage("");
            } else {
              setErrorMessage("");
              setShowForm(false);
              setShowGroupForm(true);
            }
          }}>
          <ThemedText style={styles.smallButtonText}>{showGroupForm ? "Zatvori" : "Dodaj"}</ThemedText>
        </Pressable>
      </ThemedView>

      {showGroupForm ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Nova grupa</ThemedText>
          <ThemedTextInput
            value={newGroupName}
            onChangeText={setNewGroupName}
            placeholder="Naziv grupe (A, B, Play-off)"
            style={styles.inputSpacing}
          />
          <Pressable
            style={[styles.button, groupSubmitting && styles.buttonDisabled]}
            onPress={onCreateGroup}
            disabled={groupSubmitting}>
            {groupSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Kreiraj grupu</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      ) : null}

      {groups.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema grupa u ligi.</ThemedText>
        </ThemedView>
      ) : null}
      {groups.map((g) => (
        <Pressable
          key={g.id}
          style={styles.groupCard}
          onPress={() => router.push(`/delegat/grupa/${g.id}`)}
        >
          <ThemedText type="defaultSemiBold">{g.name}</ThemedText>
          <ThemedText style={styles.hint}>Otvori ▸</ThemedText>
        </Pressable>
      ))}

      {/* SUDIJE */}
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Sudije ({sudije.length})</ThemedText>
        <Pressable
          style={styles.smallButton}
          onPress={() => {
            if (showForm) {
              setShowForm(false);
              setErrorMessage("");
            } else {
              setErrorMessage("");
              setShowGroupForm(false);
              setNewGroupName("");
              setShowForm(true);
            }
          }}>
          <ThemedText style={styles.smallButtonText}>{showForm ? "Zatvori" : "Dodaj"}</ThemedText>
        </Pressable>
      </ThemedView>

      {showForm ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Nalog sudije</ThemedText>
          <ThemedTextInput
            value={sUsername}
            onChangeText={setSUsername}
            placeholder="Username (npr. sudija.petrovic)"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={styles.inputSpacing}
          />
          <ThemedTextInput
            value={sPassword}
            onChangeText={setSPassword}
            placeholder="Password"
            secureTextEntry
            style={styles.inputSpacing}
          />
          <ThemedTextInput
            value={sFirstName}
            onChangeText={setSFirstName}
            placeholder="Ime"
            style={styles.inputSpacing}
          />
          <ThemedTextInput
            value={sLastName}
            onChangeText={setSLastName}
            placeholder="Prezime"
            style={styles.inputSpacing}
          />
          <ThemedTextInput
            value={sPhone}
            onChangeText={setSPhone}
            placeholder="Telefon"
            style={styles.inputSpacing}
          />

          <ThemedText type="defaultSemiBold" style={styles.subSection}>
            Licenca (opciono)
          </ThemedText>
          <ThemedTextInput
            value={sLicenseNumber}
            onChangeText={setSLicenseNumber}
            placeholder="Broj licence"
            style={styles.inputSpacing}
          />
          <LicenseValidUntilField
            value={sLicenseValidUntil}
            onChange={setSLicenseValidUntil}
            style={styles.inputSpacing}
          />
          <Pressable style={styles.smallButton} onPress={onPickSudijaPdf}>
            <ThemedText style={styles.smallButtonText}>
              {sPickedFile ? `PDF: ${sPickedFile.name}` : "Izaberi PDF licencu"}
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={onCreateSudija}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Kreiraj sudiju</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      ) : null}

      {sudije.map((s) => {
        const sLabel =
          s.display_name ||
          [s.first_name, s.last_name].filter(Boolean).join(" ").trim() ||
          s.username ||
          "korisnik";
        return (
        <Pressable
          key={s.user_id}
          style={styles.card}
          onPress={() => router.push(`/delegat/sudija/${s.user_id}`)}
        >
          <ThemedView style={styles.rowBetween}>
            <ThemedView style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">
                {s.display_name ||
                  [s.first_name, s.last_name].filter(Boolean).join(" ") ||
                  s.username ||
                  "-"}
              </ThemedText>
              <ThemedText>@{s.username ?? "-"}</ThemedText>
              {s.phone ? <ThemedText>Tel: {s.phone}</ThemedText> : null}
              <ThemedText style={styles.hint}>
                Otvori profil i licencu ▸
              </ThemedText>
            </ThemedView>
            <ConfirmRemoveIconButton
              title="Ukloni sudiju sa lige"
              message={`${sLabel} više neće biti dodeljen ovoj ligi. Nastaviti?`}
              onConfirm={() => onRemoveSudija(s.user_id)}
            />
          </ThemedView>
        </Pressable>
      );
      })}

    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  backButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: { fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  card: {
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  groupCard: {
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  errorText: { color: "#c53939" },
  hint: { color: ActionAccentHex, fontWeight: "600" },
  inputSpacing: { marginTop: 6 },
  button: {
    marginTop: 6,
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ActionAccentHex,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600" },
  smallButton: {
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonText: { color: ActionAccentHex, fontWeight: "600" },
  subSection: { marginTop: 6 },
});
