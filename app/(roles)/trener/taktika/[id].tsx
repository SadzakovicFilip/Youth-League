import * as Clipboard from "expo-clipboard";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useScreenPullRefresh } from "@/contexts/screen-pull-refresh-context";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { RefreshableScrollView } from "@/components/refreshable-scroll-view";

import {
  SearchableSelect,
  type SelectOption,
} from "@/components/shared/searchable-select";
import { ThemedText } from "@/components/themed-text";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedView } from "@/components/themed-view";
import {
  packTacticDescription,
  unpackTacticDescription,
} from "@/lib/tactic-description-reference";
import { supabase } from "@/lib/supabase";

const CELEBRATION_GREEN = "#047857";

type Kind = "attack" | "defense";

type ActionRow = {
  id?: number;
  name: string;
  description: string;
  position: number;
};

type Detail = {
  tactic: {
    id: number;
    club_id: number;
    name: string;
    kind: Kind;
    description: string | null;
    is_active: boolean;
    updated_at: string;
  };
  can_manage: boolean;
  actions: {
    id: number;
    name: string;
    description: string | null;
    position: number;
  }[];
};

const KIND_OPTIONS: SelectOption[] = [
  { value: "attack", label: "Napad" },
  { value: "defense", label: "Odbrana" },
];

function isYouTubeUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes("youtube.com") || u.includes("youtu.be");
}

export default function TrenerTaktikaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id || id === "new") {
    return <Redirect href="/trener" />;
  }
  const tacticId = Number(id);
  if (!Number.isFinite(tacticId)) {
    return <Redirect href="/trener" />;
  }
  return <TrenerTaktikaEditor tacticId={tacticId} />;
}

function TrenerTaktikaEditor({ tacticId }: { tacticId: number }) {
  const { colors } = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [clubId, setClubId] = useState<number | null>(null);
  const [canManage, setCanManage] = useState(true);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("attack");
  const [description, setDescription] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(
    null,
  );

  const [saving, setSaving] = useState(false);
  const [saveCelebration, setSaveCelebration] = useState(false);
  const savePulse = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    setErrorMessage("");
    setLoading(true);
    const { data: res, error } = await supabase.rpc("get_tactic_detail", {
      p_tactic_id: tacticId,
    });
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    const payload = res as Detail;
    setClubId(payload?.tactic?.club_id ?? null);
    setCanManage(!!payload?.can_manage);
    setName(payload?.tactic?.name ?? "");
    setKind((payload?.tactic?.kind ?? "attack") as Kind);
    const unpacked = unpackTacticDescription(payload?.tactic?.description);
    setDescription(unpacked.body);
    setReferenceUrl(unpacked.referenceUrl);
    setActions(
      (payload?.actions ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description ?? "",
        position: a.position,
      })),
    );
    setEditingActionIndex(null);
    setLoading(false);
  }, [tacticId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const clearCelebration = useCallback(() => {
    setSaveCelebration(false);
  }, []);

  useEffect(() => {
    if (!saveCelebration) {
      savePulse.setValue(0.88);
      return;
    }
    savePulse.setValue(0.78);
    Animated.timing(savePulse, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => {
      clearCelebration();
      router.back();
    }, 3000);
    return () => clearTimeout(t);
  }, [saveCelebration, clearCelebration, savePulse]);

  const updateAction = useCallback(
    (index: number, field: "name" | "description", value: string) => {
      setActions((prev) =>
        prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const addAction = useCallback(() => {
    let newIndex = 0;
    setActions((prev) => {
      newIndex = prev.length;
      return [
        ...prev,
        {
          name: "",
          description: "",
          position: newIndex + 1,
        },
      ];
    });
    setEditingActionIndex(newIndex);
  }, []);

  const onSave = async () => {
    setErrorMessage("");
    if (!name.trim()) {
      setErrorMessage("Ime taktike je obavezno.");
      return;
    }
    if (!clubId) {
      setErrorMessage("Klub nije pronadjen.");
      return;
    }
    const filtered = actions
      .filter((a) => a.name.trim())
      .map((a, i) => ({
        name: a.name.trim(),
        description: a.description.trim(),
        position: i + 1,
      }));
    setSaving(true);
    const packedDescription = packTacticDescription(description, referenceUrl);
    const { error } = await supabase.rpc("upsert_tactic", {
      p_tactic_id: tacticId,
      p_club_id: clubId,
      p_name: name.trim(),
      p_kind: kind,
      p_description: packedDescription.trim() === "" ? null : packedDescription,
      p_actions: filtered,
    });
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setSaveCelebration(true);
  };

  const onDelete = () => {
    Alert.alert("Obriši taktiku", "Sve akcije će takođe biti obrisane.", [
      { text: "Otkaži", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.rpc("delete_tactic", {
            p_tactic_id: tacticId,
          });
          if (error) {
            Alert.alert("Greška", error.message);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  const copyReference = async () => {
    const t = referenceUrl.trim();
    if (!t) return;
    await Clipboard.setStringAsync(t);
  };

  const openReference = () => {
    const t = referenceUrl.trim();
    if (!t) return;
    const withProto =
      /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, "")}`;
    void Linking.openURL(withProto);
  };

  useScreenPullRefresh(load);

  const actionEditMode = editingActionIndex !== null;

  return (
    <View style={[styles.screenRoot, { backgroundColor: colors.background }]}>
      <RefreshableScrollView
        style={styles.screenScroll}
        contentContainerStyle={[
          styles.container,
          { backgroundColor: colors.background },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
      {!actionEditMode ? (
        <Pressable
          style={[
            styles.backButton,
            {
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
            },
          ]}
          onPress={() => router.back()}
        >
          <ThemedText style={[styles.backText, { color: colors.text }]}>
            ← Nazad
          </ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="title" style={{ color: colors.text }}>
        Izmena taktike
      </ThemedText>

      {loading ? <ActivityIndicator color={colors.tint} /> : null}

      {errorMessage ? (
        <ThemedView
          style={[
            styles.errorCard,
            { borderColor: colors.danger, backgroundColor: colors.surface },
          ]}
        >
          <ThemedText style={[styles.errorText, { color: colors.danger }]}>
            {errorMessage}
          </ThemedText>
        </ThemedView>
      ) : null}

      {canManage ? (
        <>
          <ThemedText
            type="defaultSemiBold"
            style={{ color: colors.textSecondary }}
          >
            Tip taktike
          </ThemedText>
          <SearchableSelect
            placeholder="Izaberi tip…"
            sheetTitle="Tip taktike"
            value={kind}
            options={KIND_OPTIONS}
            clearable={false}
            onChange={(v) => setKind((v as Kind) ?? "attack")}
            containerStyle={styles.selectBlock}
          />

          <ThemedTextInput
            value={name}
            onChangeText={setName}
            placeholder={
              kind === "defense" ? "Ime odbrane" : "Ime napada / taktike"
            }
            style={styles.inputSpacing}
            editable={canManage}
          />

          <ThemedText
            type="defaultSemiBold"
            style={[styles.fieldLabel, { color: colors.textSecondary }]}
          >
            Link referenca (opciono)
          </ThemedText>
          <ThemedTextInput
            value={referenceUrl}
            onChangeText={setReferenceUrl}
            placeholder="https://… ili YouTube link"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.inputSpacing}
            editable={canManage}
          />
          {referenceUrl.trim() ? (
            <View style={styles.refActions}>
              <Pressable
                style={[
                  styles.refBtn,
                  {
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surfaceMuted,
                  },
                ]}
                onPress={() => void copyReference()}
              >
                <MaterialIcons name="content-copy" size={18} color={colors.tint} />
                <ThemedText style={[styles.refBtnText, { color: colors.tint }]}>
                  Kopiraj link
                </ThemedText>
              </Pressable>
              {isYouTubeUrl(referenceUrl) ? (
                <Pressable
                  style={[
                    styles.refBtn,
                    {
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surfaceMuted,
                    },
                  ]}
                  onPress={openReference}
                >
                  <MaterialIcons
                    name="play-circle-outline"
                    size={20}
                    color={colors.tint}
                  />
                  <ThemedText style={[styles.refBtnText, { color: colors.tint }]}>
                    Otvori (YouTube)
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  style={[
                    styles.refBtn,
                    {
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surfaceMuted,
                    },
                  ]}
                  onPress={openReference}
                >
                  <MaterialIcons name="open-in-new" size={18} color={colors.tint} />
                  <ThemedText style={[styles.refBtnText, { color: colors.tint }]}>
                    Otvori link
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ) : null}

          <ThemedTextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Opis (opciono)"
            style={[styles.inputSpacing, styles.inputMulti]}
            multiline
            editable={canManage}
          />

          {actions.length > 0 ? (
            <View style={styles.actionsSection}>
              {actions.map((a, index) => {
                const isEditing = editingActionIndex === index;
                const nameText = a.name.trim() || "—";
                const descText = a.description.trim() || "—";
                return (
                  <View
                    key={a.id ?? `idx-${index}`}
                    style={[
                      styles.actionCard,
                      {
                        borderColor: colors.borderStrong,
                        backgroundColor: colors.surfaceMuted,
                      },
                    ]}
                  >
                    <View style={styles.actionTitleRow}>
                      {isEditing ? (
                        <ThemedTextInput
                          value={a.name}
                          onChangeText={(t) => updateAction(index, "name", t)}
                          placeholder="Ime"
                          style={[styles.actionNameInput, { flex: 1 }]}
                        />
                      ) : (
                        <ThemedText
                          type="defaultSemiBold"
                          style={[styles.actionReadTitle, { color: colors.text }]}
                          numberOfLines={3}
                        >
                          {nameText}
                        </ThemedText>
                      )}
                      {canManage ? (
                        <Pressable
                          hitSlop={10}
                          style={styles.pencilWrap}
                          onPress={() =>
                            setEditingActionIndex((cur) =>
                              cur === index ? null : index,
                            )
                          }
                          accessibilityLabel={
                            isEditing ? "Završi izmenu" : "Izmeni akciju"
                          }
                        >
                          <MaterialIcons
                            name={isEditing ? "check" : "edit"}
                            size={22}
                            color={colors.tint}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                    {isEditing ? (
                      <ThemedTextInput
                        value={a.description}
                        onChangeText={(t) =>
                          updateAction(index, "description", t)
                        }
                        placeholder="Opis"
                        style={[styles.actionDescInput, { marginTop: 8 }]}
                        multiline
                      />
                    ) : (
                      <ThemedText
                        style={[
                          styles.actionReadBody,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {descText}
                      </ThemedText>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}

          {canManage && !actionEditMode ? (
            <Pressable
              style={[
                styles.addActionBtn,
                { borderColor: colors.tint, backgroundColor: colors.surface },
              ]}
              onPress={addAction}
            >
              <ThemedText style={[styles.addActionBtnText, { color: colors.tint }]}>
                + Dodaj akciju
              </ThemedText>
            </Pressable>
          ) : null}

          <Pressable
            style={[
              styles.primaryButton,
              {
                backgroundColor: saveCelebration
                  ? CELEBRATION_GREEN
                  : colors.tint,
              },
              saveCelebration && styles.saveCelebrationPad,
              (saving || saveCelebration) && styles.buttonDisabled,
            ]}
            onPress={onSave}
            disabled={saving || saveCelebration}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : saveCelebration ? (
              <View style={styles.celebrationRow}>
                <Animated.View style={{ transform: [{ scale: savePulse }] }}>
                  <MaterialIcons
                    name="check-circle"
                    size={28}
                    color="#FFFFFF"
                    accessibilityLabel="Sačuvano"
                  />
                </Animated.View>
                <ThemedText
                  lightColor="#FFFFFF"
                  darkColor="#FFFFFF"
                  style={styles.celebrationText}
                >
                  Izmene sačuvane
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                Sačuvaj izmene
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.dangerButton,
              { borderColor: colors.danger, backgroundColor: colors.surface },
            ]}
            onPress={onDelete}
          >
            <ThemedText
              style={[styles.dangerButtonText, { color: colors.danger }]}
            >
              Obriši taktiku
            </ThemedText>
          </Pressable>
        </>
      ) : null}
    </RefreshableScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  screenScroll: { flex: 1 },
  container: { gap: 12, padding: 16, paddingBottom: 28 },
  backButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backText: { fontWeight: "600" },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  errorText: { fontWeight: "600" },
  selectBlock: { alignSelf: "stretch" },
  fieldLabel: { marginTop: 8, fontSize: 13 },
  inputSpacing: { marginTop: 6 },
  inputMulti: { minHeight: 100, textAlignVertical: "top" },
  refActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  refBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  refBtnText: { fontWeight: "700", fontSize: 14 },
  actionsSection: { gap: 10, marginTop: 4 },
  actionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  actionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  actionReadTitle: { flex: 1, fontSize: 16, lineHeight: 22 },
  actionReadBody: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  actionNameInput: { minHeight: 40 },
  actionDescInput: { minHeight: 72, textAlignVertical: "top" },
  pencilWrap: { padding: 4, marginTop: -2 },
  addActionBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addActionBtnText: { fontWeight: "700", fontSize: 14 },
  primaryButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveCelebrationPad: { paddingHorizontal: 14 },
  celebrationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  celebrationText: { fontWeight: "700", fontSize: 15 },
  primaryButtonText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },
  buttonDisabled: { opacity: 0.65 },
  dangerButton: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  dangerButtonText: { fontWeight: "700" },
});
