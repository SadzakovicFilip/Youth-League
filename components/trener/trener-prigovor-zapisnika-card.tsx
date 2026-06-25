import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedTextInput } from "@/components/themed-text-input";
import { ThemedView } from "@/components/themed-view";

export type TrenerPrigovorZapisnikaColors = {
  text: string;
  textSecondary: string;
  tint: string;
  danger: string;
  success?: string;
  borderStrong: string;
  surfaceMuted: string;
  inputBorder: string;
  inputBackground: string;
  textMuted: string;
  surface: string;
};

type ObjectionExisting = {
  id: number;
  reason: string;
  created_at: string;
  status?: "pending" | "accepted" | "rejected" | string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolver_display?: string | null;
};

type ObjectionState = {
  is_trener: boolean;
  match_finished: boolean;
  deadline: string | null;
  now: string | null;
  within_window: boolean;
  can_submit: boolean;
  existing: ObjectionExisting | null;
};

type Props = {
  info: { objection?: ObjectionState | null };
  colors: TrenerPrigovorZapisnikaColors;
  formatDate: (iso: string) => string;
  formatCountdown: (s: number) => string;
  objectionTimeLeftSec: number;
  prigovorOpen: boolean;
  setPrigovorOpen: (v: boolean) => void;
  prigovorText: string;
  setPrigovorText: (t: string) => void;
  prigovorSaving: boolean;
  prigovorError: string;
  setPrigovorError: (t: string) => void;
  onSubmitPrigovor: () => void;
};

export function TrenerPrigovorZapisnikaCard({
  info,
  colors,
  formatDate,
  formatCountdown,
  objectionTimeLeftSec,
  prigovorOpen,
  setPrigovorOpen,
  prigovorText,
  setPrigovorText,
  prigovorSaving,
  prigovorError,
  setPrigovorError,
  onSubmitPrigovor,
}: Props) {
  return (
    <ThemedView
      style={[
        styles.objectionCard,
        {
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceMuted,
        },
      ]}>
      <ThemedText type="defaultSemiBold" style={[styles.boldTitle, { color: colors.text }]}>
        Prigovor na zapisnik
      </ThemedText>
      {info.objection?.existing ? (
        <ThemedView style={styles.objectionDone}>
          <ThemedText style={{ color: colors.text }}>
            Prigovor podnet: {formatDate(info.objection.existing.created_at)}
          </ThemedText>
          <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>
            {info.objection.existing.reason}
          </ThemedText>
          {(() => {
            const st = info.objection?.existing?.status ?? "pending";
            if (st === "pending") {
              return (
                <ThemedText
                  style={[styles.objectionPending, { color: colors.textSecondary }]}>
                  Odluka delegata: na čekanju.
                </ThemedText>
              );
            }
            if (st === "accepted") {
              return (
                <ThemedView style={styles.objectionDecisionBox}>
                  <ThemedText
                    style={[styles.objectionAccepted, { color: colors.success ?? "#15803d" }]}>
                    Odluka delegata: USVOJEN prigovor na zapisnik.
                  </ThemedText>
                  {info.objection.existing.resolved_at ? (
                    <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>
                      Datum odluke: {formatDate(info.objection.existing.resolved_at)}
                      {info.objection.existing.resolver_display
                        ? ` · ${info.objection.existing.resolver_display}`
                        : ""}
                    </ThemedText>
                  ) : null}
                </ThemedView>
              );
            }
            return (
              <ThemedView style={styles.objectionDecisionBox}>
                <ThemedText style={[styles.objectionRejected, { color: colors.danger }]}>
                  Odluka delegata: ODBIJEN prigovor na zapisnik.
                </ThemedText>
                {info.objection.existing.resolved_at ? (
                  <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>
                    Datum odluke: {formatDate(info.objection.existing.resolved_at)}
                    {info.objection.existing.resolver_display
                      ? ` · ${info.objection.existing.resolver_display}`
                      : ""}
                  </ThemedText>
                ) : null}
              </ThemedView>
            );
          })()}
        </ThemedView>
      ) : info.objection?.match_finished ? (
        info.objection.is_trener ? (
          info.objection.within_window ? (
            <>
              <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>
                Rok za prigovor ističe za {formatCountdown(objectionTimeLeftSec)}.
              </ThemedText>
              {!prigovorOpen ? (
                <Pressable
                  style={[styles.prigovorBtn, { backgroundColor: colors.tint }]}
                  onPress={() => setPrigovorOpen(true)}>
                  <ThemedText style={styles.prigovorBtnText}>PRIGOVOR</ThemedText>
                </Pressable>
              ) : (
                <ThemedView style={styles.prigovorForm}>
                  <ThemedTextInput
                    style={[
                      styles.prigovorInput,
                      {
                        borderColor: colors.inputBorder,
                        backgroundColor: colors.inputBackground,
                        color: colors.text,
                      },
                    ]}
                    placeholder="Obrazloženje prigovora..."
                    placeholderTextColor={colors.textMuted}
                    value={prigovorText}
                    onChangeText={setPrigovorText}
                    multiline
                    numberOfLines={5}
                    editable={!prigovorSaving}
                  />
                  {prigovorError ? (
                    <ThemedText style={[styles.errorInline, { color: colors.danger }]}>
                      {prigovorError}
                    </ThemedText>
                  ) : null}
                  <ThemedView style={styles.prigovorRow}>
                    <Pressable
                      style={[
                        styles.cancelBtn,
                        {
                          borderColor: colors.borderStrong,
                          backgroundColor: colors.surface,
                        },
                        prigovorSaving && styles.saveBtnDisabled,
                      ]}
                      onPress={() => {
                        setPrigovorOpen(false);
                        setPrigovorText("");
                        setPrigovorError("");
                      }}
                      disabled={prigovorSaving}>
                      <ThemedText style={[styles.cancelBtnText, { color: colors.text }]}>
                        Odustani
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.submitBtn,
                        { backgroundColor: colors.danger },
                        prigovorSaving && styles.saveBtnDisabled,
                      ]}
                      onPress={onSubmitPrigovor}
                      disabled={prigovorSaving}>
                      {prigovorSaving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <ThemedText style={styles.submitBtnText}>POŠALJI PRIGOVOR</ThemedText>
                      )}
                    </Pressable>
                  </ThemedView>
                </ThemedView>
              )}
            </>
          ) : (
            <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>
              Rok od 30 minuta za podnošenje prigovora je istekao. Smatra se da nemate prigovora na
              zapisnik.
            </ThemedText>
          )
        ) : (
          <ThemedText style={[styles.muted, { color: colors.textSecondary }]}>
            Samo trener kluba učesnika može da podnese prigovor.
          </ThemedText>
        )
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  objectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  } as ViewStyle,
  boldTitle: {} as TextStyle,
  muted: { fontSize: 14, lineHeight: 20 },
  objectionDone: { gap: 6 },
  objectionPending: { marginTop: 4, fontWeight: "600" },
  objectionDecisionBox: { marginTop: 6, gap: 4 },
  objectionAccepted: { fontWeight: "700" },
  objectionRejected: { fontWeight: "700" },
  prigovorBtn: {
    borderRadius: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  prigovorBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 1 },
  prigovorForm: { gap: 8 },
  prigovorInput: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  prigovorRow: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelBtnText: { fontWeight: "600" },
  submitBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "700" },
  errorInline: { fontWeight: "600" },
  saveBtnDisabled: { opacity: 0.6 },
});
