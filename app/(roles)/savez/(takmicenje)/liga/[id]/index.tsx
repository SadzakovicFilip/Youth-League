import { RefreshableScrollView } from "@/components/refreshable-scroll-view";
import { ActionAccentHex } from "@/constants/theme";
import { useScreenPullRefresh } from "@/contexts/screen-pull-refresh-context";
import * as DocumentPicker from "expo-document-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { ConfirmRemoveIconButton } from "@/components/confirm-remove-icon-button";
import { LicenseValidUntilField } from "@/components/license-valid-until-field";
import type { BreadcrumbItem } from "@/components/savez/savez-breadcrumbs";
import {
  SavezLeagueAccordionSection,
  SavezLeagueTakmicenjeEntry,
} from "@/components/savez/savez-league-accordion-section";
import {
  SavezNumberedListActionRow,
  SavezNumberedListBlock,
  SavezNumberedListRow,
} from "@/components/savez/savez-numbered-list";
import { ThemedText } from "@/components/themed-text";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedView } from "@/components/themed-view";
import { useSyncTakmicenjeDrillChrome } from "@/contexts/takmicenje-drill-chrome-context";
import { sanitizeUsername } from "@/lib/auth";
import {
  pickLicensePdf,
  saveUserLicense,
  uploadLicensePdf,
} from "@/lib/license-upload";
import { supabase } from "@/lib/supabase";

type League = {
  id: number;
  name: string;
  season: string | null;
  region_id: number;
};
type Club = { id: number; name: string; league_id: number | null };
type Group = { id: number; league_id: number; name: string };
type Delegate = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};
type Sudija = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};
type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export default function LigaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leagueId = Number(id);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [league, setLeague] = useState<League | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [sudije, setSudije] = useState<Sudija[]>([]);

  // --- add club form ---
  const [clubName, setClubName] = useState("");
  const [kdUsername, setKdUsername] = useState("");
  const [kdPassword, setKdPassword] = useState("");
  const [kdFirstName, setKdFirstName] = useState("");
  const [kdLastName, setKdLastName] = useState("");
  const [kdPhone, setKdPhone] = useState("");
  const [showClubForm, setShowClubForm] = useState(false);
  const [clubSubmitting, setClubSubmitting] = useState(false);

  // --- add group form ---
  const [newGroupName, setNewGroupName] = useState("");
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);

  // --- add delegate form ---
  const [showDelegateForm, setShowDelegateForm] = useState(false);
  const [delUsername, setDelUsername] = useState("");
  const [delPassword, setDelPassword] = useState("");
  const [delFirstName, setDelFirstName] = useState("");
  const [delLastName, setDelLastName] = useState("");
  const [delPhone, setDelPhone] = useState("");
  const [delegateSubmitting, setDelegateSubmitting] = useState(false);

  // --- add sudija form ---
  const [showSudijaForm, setShowSudijaForm] = useState(false);
  const [sUsername, setSUsername] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [sFirstName, setSFirstName] = useState("");
  const [sLastName, setSLastName] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sLicenseNumber, setSLicenseNumber] = useState("");
  const [sLicenseValidUntil, setSLicenseValidUntil] = useState("");
  const [sPickedFile, setSPickedFile] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [sudijaSubmitting, setSudijaSubmitting] = useState(false);

  const [openClubsList, setOpenClubsList] = useState(false);
  const [openDelegatesList, setOpenDelegatesList] = useState(false);
  const [openSudijeList, setOpenSudijeList] = useState(false);
  const [openGrupeList, setOpenGrupeList] = useState(false);
  const [regionName, setRegionName] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!Number.isFinite(leagueId)) {
      setErrorMessage("Nevazeca liga.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage("");
    const [{ data, error }, sRes] = await Promise.all([
      supabase.rpc("get_league_detail", { p_league_id: leagueId }),
      supabase.rpc("get_league_sudije", { p_league_id: leagueId }),
    ]);
    if (sRes.error) {
      setSudije([]);
    } else {
      setSudije(((sRes.data ?? []) as Sudija[]) || []);
    }
    if (error) {
      setErrorMessage(error.message);
      setLeague(null);
      setClubs([]);
      setGroups([]);
      setDelegates([]);
      setRegionName(null);
    } else {
      const payload = (data ?? {}) as {
        league: League | null;
        clubs: Club[];
        groups: Group[];
        delegates: Delegate[];
      };
      const le = payload.league ?? null;
      setLeague(le);
      if (le?.region_id != null) {
        const { data: reg } = await supabase
          .from("regions")
          .select("name")
          .eq("id", le.region_id)
          .maybeSingle();
        setRegionName((reg?.name as string | undefined) ?? null);
      } else {
        setRegionName(null);
      }
      setClubs(payload.clubs ?? []);
      setGroups(payload.groups ?? []);
      let resolvedDelegates = Array.isArray(payload.delegates)
        ? payload.delegates
        : [];

      // Compatibility fallback: if SQL function is older or returns empty delegates,
      // load delegates directly from league_delegates + profiles.
      if (resolvedDelegates.length === 0) {
        const { data: leagueDelegateRows } = await supabase
          .from("league_delegates")
          .select("user_id")
          .eq("league_id", leagueId);

        const userIds = (leagueDelegateRows ?? []).map(
          (r: { user_id: string }) => r.user_id,
        );
        if (userIds.length > 0) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("id, username, display_name, first_name, last_name, phone")
            .in("id", userIds);

          const profileById = new Map(
            (profileRows ?? []).map((p) => [p.id, p as ProfileLite]),
          );
          resolvedDelegates = userIds.map((uid) => {
            const p = profileById.get(uid);
            return {
              user_id: uid,
              username: p?.username ?? null,
              display_name: p?.display_name ?? null,
              first_name: p?.first_name ?? null,
              last_name: p?.last_name ?? null,
              phone: p?.phone ?? null,
            };
          });
        }
      }

      setDelegates(resolvedDelegates);
    }
    setLoading(false);
  }, [leagueId]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const onCreateClub = async () => {
    if (!clubName.trim() || !kdUsername.trim() || !kdPassword.trim()) {
      setErrorMessage("Naziv kluba, username i password kluba su obavezni.");
      return;
    }
    const safeUsername = sanitizeUsername(kdUsername);
    if (!safeUsername) {
      setErrorMessage("Username mora sadrzati slova/brojeve.");
      return;
    }
    setClubSubmitting(true);
    setErrorMessage("");

    // 1) create club row
    const { data: clubRow, error: clubErr } = await supabase
      .from("clubs")
      .insert({ name: clubName.trim(), league_id: leagueId })
      .select("id")
      .maybeSingle();
    if (clubErr || !clubRow) {
      setErrorMessage(`Klub: ${clubErr?.message ?? "insert failed"}`);
      setClubSubmitting(false);
      return;
    }
    const newClubId = clubRow.id as number;

    // 2) create klub user + membership via Edge function
    const { error: fnErr } = await supabase.functions.invoke(
      "create-managed-user",
      {
        body: {
          role: "klub",
          username: safeUsername,
          password: kdPassword,
          display_name:
            [kdFirstName, kdLastName].filter(Boolean).join(" ") || safeUsername,
          first_name: kdFirstName || undefined,
          last_name: kdLastName || undefined,
          phone: kdPhone || undefined,
          club_id: newClubId,
          member_role: "klub",
        },
      },
    );

    if (fnErr) {
      // rollback club
      await supabase.from("clubs").delete().eq("id", newClubId);
      let raw = "";
      try {
        const text = await fnErr.context?.text?.();
        raw = text ? ` | RAW: ${text}` : "";
      } catch {
        raw = "";
      }
      setErrorMessage(`Klub: ${fnErr.message}${raw}`);
      setClubSubmitting(false);
      return;
    }

    // 3) Safety net: garantuj club_memberships(member_role='klub', active=true)
    // za novi nalog. Edge funkcija u nekim slučajevima ne upiše to članstvo,
    // pa korisnik posle login-a vidi "Nije pronadjen klub...". RPC je idempotentan.
    const { error: ensureErr } = await supabase.rpc(
      "savez_ensure_klub_club_membership",
      { p_club_id: newClubId, p_username: safeUsername },
    );
    if (ensureErr) {
      await supabase.from("clubs").delete().eq("id", newClubId);
      setErrorMessage(
        `Klub kreiran ali članstvo nije postavljeno: ${ensureErr.message}`,
      );
      setClubSubmitting(false);
      return;
    }

    setClubName("");
    setKdUsername("");
    setKdPassword("");
    setKdFirstName("");
    setKdLastName("");
    setKdPhone("");
    setShowClubForm(false);
    setClubSubmitting(false);
    await loadAll();
  };

  const onCreateDelegate = async () => {
    if (!delUsername.trim() || !delPassword.trim()) {
      setErrorMessage("Username i password delegata su obavezni.");
      return;
    }
    const safeUsername = sanitizeUsername(delUsername);
    if (!safeUsername) {
      setErrorMessage("Username mora sadrzati slova/brojeve.");
      return;
    }
    setDelegateSubmitting(true);
    setErrorMessage("");

    // kreiraj delegata i odmah ga veži za ovu ligu (league_id)
    const { error: fnErr } = await supabase.functions.invoke(
      "create-managed-user",
      {
        body: {
          role: "delegat",
          username: safeUsername,
          password: delPassword,
          display_name:
            [delFirstName, delLastName].filter(Boolean).join(" ") ||
            safeUsername,
          first_name: delFirstName || undefined,
          last_name: delLastName || undefined,
          phone: delPhone || undefined,
          league_id: leagueId,
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
      setErrorMessage(`Delegat: ${fnErr.message}${raw}`);
      setDelegateSubmitting(false);
      return;
    }

    setDelUsername("");
    setDelPassword("");
    setDelFirstName("");
    setDelLastName("");
    setDelPhone("");
    setShowDelegateForm(false);
    setDelegateSubmitting(false);
    await loadAll();
  };

  const onRemoveDelegate = async (userId: string) => {
    const { error } = await supabase
      .from("league_delegates")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", userId);
    if (error) {
      setErrorMessage(`Uklanjanje delegata: ${error.message}`);
      return;
    }
    await loadAll();
  };

  const onPickSudijaPdf = async () => {
    const picked = await pickLicensePdf();
    if (picked) setSPickedFile(picked);
  };

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
    setSudijaSubmitting(true);
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
      setSudijaSubmitting(false);
      return;
    }

    const newUserId =
      (created as { user_id?: string; id?: string } | null)?.user_id ??
      (created as { user_id?: string; id?: string } | null)?.id ??
      null;

    if (!newUserId) {
      setErrorMessage("Sudija kreiran ali nije vracen user_id.");
      setSudijaSubmitting(false);
      return;
    }

    const { error: linkErr } = await supabase
      .from("league_sudije")
      .insert({ league_id: leagueId, user_id: newUserId });
    if (linkErr) {
      setErrorMessage(
        `Sudija kreiran, ali nije vezan za ligu: ${linkErr.message}`,
      );
      setSudijaSubmitting(false);
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
          setSudijaSubmitting(false);
          await loadAll();
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
        setSudijaSubmitting(false);
        await loadAll();
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
    setShowSudijaForm(false);
    setSudijaSubmitting(false);
    await loadAll();
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
    await loadAll();
  };

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
    setShowAddGroupForm(false);
    await loadAll();
  };

  const chromeTitle = league?.name ?? "Liga";
  const chromeItems = useMemo<BreadcrumbItem[]>(
    () => [
      { label: "Regije", path: "/savez" },
      ...(league?.region_id != null
        ? [
            {
              label: regionName ?? `Regija #${league.region_id}`,
              path: `/savez/regija/${league.region_id}`,
            },
          ]
        : []),
      { label: chromeTitle },
    ],
    [chromeTitle, league?.region_id, regionName],
  );
  useSyncTakmicenjeDrillChrome(true, chromeTitle, chromeItems);

  useScreenPullRefresh(loadAll);

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      <ThemedText>Sezona: {league?.season ?? "-"}</ThemedText>

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      <SavezLeagueAccordionSection
        title="Klubovi"
        count={clubs.length}
        listExpanded={openClubsList}
        onToggleList={() => setOpenClubsList((v) => !v)}
        formOpen={showClubForm}
        onToggleForm={() => setShowClubForm((v) => !v)}
        addLabel="Dodaj"
        closeFormLabel="Zatvori"
        form={
          <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold">Klub</ThemedText>
            <ThemedTextInput
              value={clubName}
              onChangeText={setClubName}
              placeholder="Naziv kluba (npr. KK Partizan)"
              style={styles.inputSpacing}
            />
            <ThemedText type="defaultSemiBold">Nalog kluba</ThemedText>
            <ThemedTextInput
              value={kdUsername}
              onChangeText={setKdUsername}
              placeholder="Username (npr. direktor.partizan)"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              style={styles.inputSpacing}
            />
            <ThemedTextInput
              value={kdPassword}
              onChangeText={setKdPassword}
              placeholder="Password"
              secureTextEntry
              style={styles.inputSpacing}
            />
            <ThemedTextInput
              value={kdFirstName}
              onChangeText={setKdFirstName}
              placeholder="Ime"
              style={styles.inputSpacing}
            />
            <ThemedTextInput
              value={kdLastName}
              onChangeText={setKdLastName}
              placeholder="Prezime"
              style={styles.inputSpacing}
            />
            <ThemedTextInput
              value={kdPhone}
              onChangeText={setKdPhone}
              placeholder="Telefon"
              style={styles.inputSpacing}
            />
            <Pressable
              style={[styles.button, clubSubmitting && styles.buttonDisabled]}
              onPress={onCreateClub}
              disabled={clubSubmitting}
            >
              {clubSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>
                  Kreiraj klub + direktora
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
        }
      >
        <SavezNumberedListBlock
          embedded
          hint="Klubovi u ovoj ligi (bez navigacije na detalj)."
          emptyLabel="Nema klubova u ligi."
          loading={false}
          isEmpty={clubs.length === 0}
        >
          {clubs.map((c, idx) => (
            <SavezNumberedListRow key={c.id} index={idx}>
              <ThemedText type="defaultSemiBold">{c.name}</ThemedText>
              <ThemedText>ID: {c.id}</ThemedText>
            </SavezNumberedListRow>
          ))}
        </SavezNumberedListBlock>
      </SavezLeagueAccordionSection>

      <SavezLeagueAccordionSection
        title="Delegati"
        count={delegates.length}
        listExpanded={openDelegatesList}
        onToggleList={() => setOpenDelegatesList((v) => !v)}
        formOpen={showDelegateForm}
        onToggleForm={() => setShowDelegateForm((v) => !v)}
        addLabel="Dodaj"
        closeFormLabel="Zatvori"
        form={
          <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold">Nalog delegata</ThemedText>
            <ThemedTextInput
              value={delUsername}
              onChangeText={setDelUsername}
              placeholder="Username (npr. delegat.prva)"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              style={styles.inputSpacing}
            />
            <ThemedTextInput
              value={delPassword}
              onChangeText={setDelPassword}
              placeholder="Password"
              secureTextEntry
              style={styles.inputSpacing}
            />
            <ThemedTextInput
              value={delFirstName}
              onChangeText={setDelFirstName}
              placeholder="Ime"
              style={styles.inputSpacing}
            />
            <ThemedTextInput
              value={delLastName}
              onChangeText={setDelLastName}
              placeholder="Prezime"
              style={styles.inputSpacing}
            />
            <ThemedTextInput
              value={delPhone}
              onChangeText={setDelPhone}
              placeholder="Telefon"
              style={styles.inputSpacing}
            />
            <Pressable
              style={[
                styles.button,
                delegateSubmitting && styles.buttonDisabled,
              ]}
              onPress={onCreateDelegate}
              disabled={delegateSubmitting}
            >
              {delegateSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>
                  Kreiraj delegata
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
        }
      >
        <SavezNumberedListBlock
          embedded
          hint="Uklanjanje: ikonica X pored imena. Delegat ostaje u listi dok ga ne ukloniš."
          emptyLabel="Nema dodeljenih delegata."
          loading={false}
          isEmpty={delegates.length === 0}
        >
          {delegates.map((d, idx) => {
            const dLabel =
              d.display_name ||
              [d.first_name, d.last_name].filter(Boolean).join(" ").trim() ||
              d.username ||
              "korisnik";
            return (
              <SavezNumberedListActionRow
                key={d.user_id}
                index={idx}
                main={
                  <ThemedView style={{ gap: 2 }}>
                    <ThemedText type="defaultSemiBold">
                      {d.display_name ||
                        [d.first_name, d.last_name].filter(Boolean).join(" ") ||
                        d.username ||
                        "-"}
                    </ThemedText>
                    <ThemedText>@{d.username ?? "-"}</ThemedText>
                    {d.phone ? <ThemedText>Tel: {d.phone}</ThemedText> : null}
                  </ThemedView>
                }
                trailing={
                  <ConfirmRemoveIconButton
                    title="Ukloni delegata"
                    message={`${dLabel} više neće biti delegat ove lige. Nastaviti?`}
                    onConfirm={() => onRemoveDelegate(d.user_id)}
                  />
                }
              />
            );
          })}
        </SavezNumberedListBlock>
      </SavezLeagueAccordionSection>

      <SavezLeagueAccordionSection
        title="Sudije"
        count={sudije.length}
        listExpanded={openSudijeList}
        onToggleList={() => setOpenSudijeList((v) => !v)}
        formOpen={showSudijaForm}
        onToggleForm={() => setShowSudijaForm((v) => !v)}
        addLabel="Dodaj"
        closeFormLabel="Zatvori"
        form={
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
                {sPickedFile
                  ? `PDF: ${sPickedFile.name}`
                  : "Izaberi PDF licencu"}
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.button, sudijaSubmitting && styles.buttonDisabled]}
              onPress={onCreateSudija}
              disabled={sudijaSubmitting}
            >
              {sudijaSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>
                  Kreiraj sudiju
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
        }
      >
        <SavezNumberedListBlock
          embedded
          hint="Klik na ime otvara profil sudije. Ikonica X uklanja sudiju iz lige (potvrda u dijalogu)."
          emptyLabel="Nema sudija u ligi."
          loading={false}
          isEmpty={sudije.length === 0}
        >
          {sudije.map((s, idx) => {
            const sLabel =
              s.display_name ||
              [s.first_name, s.last_name].filter(Boolean).join(" ").trim() ||
              s.username ||
              "korisnik";
            return (
              <SavezNumberedListActionRow
                key={s.user_id}
                index={idx}
                main={
                  <Pressable
                    onPress={() => router.push(`/savez/sudija/${s.user_id}`)}
                    style={{ gap: 2 }}
                  >
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
                  </Pressable>
                }
                trailing={
                  <ConfirmRemoveIconButton
                    title="Ukloni sudiju sa lige"
                    message={`${sLabel} više neće biti dodeljen ovoj ligi. Nastaviti?`}
                    onConfirm={() => onRemoveSudija(s.user_id)}
                  />
                }
              />
            );
          })}
        </SavezNumberedListBlock>
      </SavezLeagueAccordionSection>

      <SavezLeagueAccordionSection
        title="Grupe"
        count={groups.length}
        listExpanded={openGrupeList}
        onToggleList={() => setOpenGrupeList((v) => !v)}
        formOpen={showAddGroupForm}
        onToggleForm={() => {
          if (showAddGroupForm) {
            setShowAddGroupForm(false);
            setNewGroupName("");
            setErrorMessage("");
          } else {
            setErrorMessage("");
            setShowAddGroupForm(true);
          }
        }}
        addLabel="Dodaj"
        closeFormLabel="Zatvori"
        form={
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
              disabled={groupSubmitting}
            >
              {groupSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Kreiraj grupu</ThemedText>
              )}
            </Pressable>
          </ThemedView>
        }
      >
        <SavezNumberedListBlock
          embedded
          hint="Klik na red otvara grupu."
          emptyLabel="Nema grupa u ligi."
          loading={loading}
          isEmpty={groups.length === 0}
        >
          {groups.map((g, idx) => (
            <SavezNumberedListRow
              key={g.id}
              index={idx}
              onPress={() => router.push(`/savez/grupa/${g.id}`)}
            >
              <ThemedText type="defaultSemiBold">{g.name}</ThemedText>
            </SavezNumberedListRow>
          ))}
        </SavezNumberedListBlock>
      </SavezLeagueAccordionSection>

      <SavezLeagueTakmicenjeEntry
        onPress={() => router.push(`/savez/liga/${leagueId}/takmicenje`)}
      />
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  card: {
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  inputSpacing: { marginTop: 6 },
  button: {
    marginTop: 6,
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ActionAccentHex,
  },
  smallButton: {
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonText: { color: ActionAccentHex, fontWeight: "600" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600" },
  errorText: { color: "#c53939" },
  subSection: { marginTop: 6 },
  hint: { color: ActionAccentHex, fontWeight: "600", marginTop: 4 },
});
