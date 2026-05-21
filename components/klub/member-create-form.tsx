import { ActionAccentHex } from "@/constants/theme";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedView } from "@/components/themed-view";
import { sanitizeUsername } from "@/lib/auth";
import { getMyClubContext } from "@/lib/club-context";
import { supabase } from "@/lib/supabase";

type CreateRole = "igrac" | "trener" | "zapisnicar";

type MemberCreateFormProps = {
  targetRole: CreateRole;
  title: string;
  description: string;
  /** Bez back dugmeta i naslova — za akordeon unutar taba „Upravljanje“. */
  embedded?: boolean;
  /** Poziva se nakon uspešnog kreiranja (embedded). */
  onCreated?: () => void;
};

export function MemberCreateForm({
  targetRole,
  title,
  description,
  embedded = false,
  onCreated,
}: MemberCreateFormProps) {
  const [clubId, setClubId] = useState<number | null>(null);
  const [clubLabel, setClubLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    const loadClub = async () => {
      const { data, error } = await getMyClubContext();
      if (error || !data) {
        setResult(error ?? "Nije pronadjen klub kontekst.");
        return;
      }
      setClubId(data.clubId);
      setClubLabel(data.clubName);
    };
    loadClub();
  }, []);

  const onCreate = async () => {
    if (!clubId || !username.trim() || !password.trim()) {
      setResult("Klub, username i password su obavezni.");
      return;
    }
    const safeUsername = sanitizeUsername(username);
    if (!safeUsername) {
      setResult("Username mora sadrzati slova/brojeve.");
      return;
    }

    setLoading(true);
    setResult("");

    const { data, error } = await supabase.functions.invoke(
      "create-managed-user",
      {
        body: {
          role: targetRole,
          username: safeUsername,
          password,
          display_name: displayName || undefined,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          birth_date: birthDate || undefined,
          address: address || undefined,
          phone: phone || undefined,
          club_id: clubId,
          member_role: targetRole,
        },
      },
    );

    if (error) {
      let raw = "";
      try {
        const text = await error.context?.text?.();
        raw = text ? ` | RAW: ${text}` : "";
      } catch {
        raw = "";
      }
      setResult(`ERROR: ${error.message}${raw}`);
      setLoading(false);
      return;
    }

    setResult(`OK: ${targetRole} kreiran. ID: ${data?.user_id ?? "-"}`);
    setUsername("");
    setPassword("");
    setDisplayName("");
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setAddress("");
    setPhone("");
    setLoading(false);
    onCreated?.();
  };

  const body = (
    <>
      {!embedded ? (
        <>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ThemedText style={styles.backText}>← Nazad</ThemedText>
          </Pressable>
          <ThemedText type="title">{title}</ThemedText>
          <ThemedText>{description}</ThemedText>
        </>
      ) : (
        <ThemedText style={styles.embeddedLead}>{description}</ThemedText>
      )}
      <ThemedText>Klub: {clubLabel || "-"}</ThemedText>

      <Field
        label="Username *"
        value={username}
        onChangeText={setUsername}
        placeholder="npr. korisnik1"
      />
      <Field
        label="Password *"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Field
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <Field label="First name" value={firstName} onChangeText={setFirstName} />
      <Field label="Last name" value={lastName} onChangeText={setLastName} />
      <Field
        label="Birth date (YYYY-MM-DD)"
        value={birthDate}
        onChangeText={setBirthDate}
      />
      <Field label="Address" value={address} onChangeText={setAddress} />
      <Field label="Phone" value={phone} onChangeText={setPhone} />

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={onCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Kreiraj</ThemedText>
        )}
      </Pressable>

      {result ? (
        <ThemedView style={styles.card}>
          <ThemedText>{result}</ThemedText>
        </ThemedView>
      ) : null}
    </>
  );

  if (embedded) {
    return <View style={styles.embeddedRoot}>{body}</View>;
  }

  return <ScrollView contentContainerStyle={styles.container}>{body}</ScrollView>;
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
}: FieldProps) {
  return (
    <ThemedView style={styles.fieldGroup}>
      <ThemedText>{label}</ThemedText>
      <ThemedTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        style={styles.inputSpacing}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  embeddedRoot: { gap: 10 },
  embeddedLead: { opacity: 0.88, fontSize: 14 },
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
  fieldGroup: { gap: 6 },
  inputSpacing: { marginTop: 4 },
  button: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ActionAccentHex,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600" },
  card: {
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
});
