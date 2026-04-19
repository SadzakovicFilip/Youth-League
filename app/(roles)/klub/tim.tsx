import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ClubContext, getMyClubContext, mapRpcClubContext } from '@/lib/club-context';
import { openLicensePdf } from '@/lib/license-viewer';
import { supabase } from '@/lib/supabase';

type TeamMember = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date?: string | null;
  address?: string | null;
  phone?: string | null;
  fee_status?: string | null;
  fee_amount_due?: number | null;
  fee_amount_paid?: number | null;
  fee_period_month?: string | null;
  fee_due_date?: string | null;
  total_unpaid?: number | null;
  current_month_status?: string | null;
  current_month_due?: number | null;
  license_valid_until?: string | null;
  license_file_path?: string | null;
  license_number?: string | null;
};

type LicenseEdit = {
  validUntil: string;
  licenseNumber: string;
  pickedFile: DocumentPicker.DocumentPickerAsset | null;
  saving: boolean;
};

type ClubTeamPayload = {
  context: {
    club_id: number;
    club_name: string;
    league_id: number | null;
    league_name: string | null;
    region_id: number | null;
    region_name: string | null;
    group_id: number | null;
    group_name: string | null;
    monthly_fee: number | null;
  } | null;
  players: TeamMember[];
  trainers: TeamMember[];
};

const base64ToArrayBuffer = (base64: string) => {
  const binaryString =
    typeof globalThis.atob === 'function'
      ? globalThis.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

export default function KlubTimScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [context, setContext] = useState<ClubContext | null>(null);
  const [players, setPlayers] = useState<TeamMember[]>([]);
  const [trainers, setTrainers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<'igraci' | 'treneri'>('igraci');
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [licenseEdits, setLicenseEdits] = useState<Record<string, LicenseEdit>>({});
  const [monthlyFee, setMonthlyFee] = useState<number | null>(null);
  const [payingPlayerId, setPayingPlayerId] = useState<string | null>(null);
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [feeDialogValue, setFeeDialogValue] = useState('');
  const [feeDialogSaving, setFeeDialogSaving] = useState(false);
  const [partialDialogOpen, setPartialDialogOpen] = useState(false);
  const [partialDialogValue, setPartialDialogValue] = useState('');
  const [partialDialogSaving, setPartialDialogSaving] = useState(false);
  const [partialDialogPlayerId, setPartialDialogPlayerId] = useState<string | null>(null);

  const setMemberLicenseState = (userId: string, patch: Partial<LicenseEdit>) => {
    setLicenseEdits((prev) => ({
      ...prev,
      [userId]: {
        validUntil: prev[userId]?.validUntil ?? '',
        licenseNumber: prev[userId]?.licenseNumber ?? '',
        pickedFile: prev[userId]?.pickedFile ?? null,
        saving: prev[userId]?.saving ?? false,
        ...patch,
      },
    }));
  };

  const syncLicenseEditors = (members: TeamMember[]) => {
    setLicenseEdits((prev) => {
      const next: Record<string, LicenseEdit> = {};
      for (const member of members) {
        next[member.user_id] = {
          validUntil: prev[member.user_id]?.validUntil ?? member.license_valid_until ?? '',
          licenseNumber: prev[member.user_id]?.licenseNumber ?? member.license_number ?? '',
          pickedFile: prev[member.user_id]?.pickedFile ?? null,
          saving: false,
        };
      }
      return next;
    });
  };

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_klub_team_overview', {
      p_club_id: null,
    });

    if (!rpcErr && rpcData) {
      const payload = rpcData as ClubTeamPayload;
      const mappedCtx = mapRpcClubContext(payload.context);
      if (mappedCtx) setContext(mappedCtx);
      setMonthlyFee(payload.context?.monthly_fee ?? null);
      const rpcPlayers = payload.players ?? [];
      const rpcTrainers = payload.trainers ?? [];
      setPlayers(rpcPlayers);
      setTrainers(rpcTrainers);
      syncLicenseEditors([...rpcPlayers, ...rpcTrainers]);
      setLoading(false);
      return;
    }

    const { data: clubCtx, error: ctxErr } = await getMyClubContext();
    if (ctxErr || !clubCtx) {
      setErrorMessage(ctxErr ?? 'Nije pronadjen klub kontekst.');
      setLoading(false);
      return;
    }
    setContext(clubCtx);

    const { data: memberships, error: mErr } = await supabase
      .from('club_memberships')
      .select('user_id, member_role')
      .eq('club_id', clubCtx.clubId)
      .eq('active', true)
      .in('member_role', ['igrac', 'trener']);

    if (mErr) {
      setErrorMessage(mErr.message);
      setLoading(false);
      return;
    }

    const userIds = (memberships ?? []).map((row) => row.user_id);
    if (userIds.length === 0) {
      setPlayers([]);
      setTrainers([]);
      setLicenseEdits({});
      setLoading(false);
      return;
    }

    const [pRes, fRes, lRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name, first_name, last_name, birth_date, address, phone')
        .in('id', userIds),
      supabase
        .from('player_fees')
        .select('id, player_id, status, amount_due, amount_paid, period_month, due_date')
        .in(
          'player_id',
          (memberships ?? [])
            .filter((m) => m.member_role === 'igrac')
            .map((m) => m.user_id)
        )
        .order('period_month', { ascending: false }),
      supabase
        .from('user_licenses')
        .select('user_id, valid_until, license_file_path, license_number')
        .in('user_id', userIds),
    ]);

    if (pRes.error || fRes.error || lRes.error) {
      setErrorMessage(pRes.error?.message || fRes.error?.message || lRes.error?.message || 'Greska.');
      setLoading(false);
      return;
    }

    const profileById = new Map((pRes.data ?? []).map((p) => [p.id, p]));
    type FeeLite = {
      player_id: string;
      status: string | null;
      amount_due: number | null;
      amount_paid: number | null;
      period_month: string | null;
      due_date: string | null;
    };
    const latestFeeByPlayer = new Map<string, FeeLite>();
    for (const fee of fRes.data ?? []) {
      if (!latestFeeByPlayer.has(fee.player_id)) latestFeeByPlayer.set(fee.player_id, fee);
    }
    const licenseByUser = new Map((lRes.data ?? []).map((l) => [l.user_id, l]));

    const mappedPlayers: TeamMember[] = [];
    const mappedTrainers: TeamMember[] = [];

    for (const member of memberships ?? []) {
      const p = profileById.get(member.user_id);
      const license = licenseByUser.get(member.user_id);
      const base: TeamMember = {
        user_id: member.user_id,
        username: p?.username ?? null,
        display_name: p?.display_name ?? null,
        first_name: p?.first_name ?? null,
        last_name: p?.last_name ?? null,
        birth_date: p?.birth_date ?? null,
        address: p?.address ?? null,
        phone: p?.phone ?? null,
        license_valid_until: license?.valid_until ?? null,
        license_file_path: license?.license_file_path ?? null,
        license_number: (license as { license_number?: string | null } | undefined)?.license_number ?? null,
      };

      if (member.member_role === 'igrac') {
        const fee = latestFeeByPlayer.get(member.user_id);
        mappedPlayers.push({
          ...base,
          fee_status: fee?.status ?? null,
          fee_amount_due: fee?.amount_due ?? null,
          fee_amount_paid: fee?.amount_paid ?? null,
          fee_period_month: fee?.period_month ?? null,
          fee_due_date: fee?.due_date ?? null,
        });
      } else {
        mappedTrainers.push(base);
      }
    }

    setPlayers(mappedPlayers);
    setTrainers(mappedTrainers);
    syncLicenseEditors([...mappedPlayers, ...mappedTrainers]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTeam();
    }, [loadTeam])
  );

  const filteredPlayers = useMemo(() => {
    if (!onlyUnpaid) return players;
    return players.filter((p) => {
      const status = (p.fee_status ?? '').toLowerCase();
      return !!status && !['placeno', 'paid'].includes(status);
    });
  }, [players, onlyUnpaid]);

  const pickPdf = async (userId: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setMemberLicenseState(userId, { pickedFile: result.assets[0] });
  };

  const saveLicense = async (member: TeamMember) => {
    const state = licenseEdits[member.user_id];
    const validUntil = state?.validUntil?.trim() || null;
    const licenseNumber = state?.licenseNumber?.trim() || null;
    const picked = state?.pickedFile ?? null;

    if (!validUntil && !picked && !licenseNumber) {
      setErrorMessage('Unesi broj licence, datum i/ili izaberi PDF pre snimanja.');
      return;
    }

    setMemberLicenseState(member.user_id, { saving: true });
    setErrorMessage('');

    let finalPath = member.license_file_path ?? null;
    if (picked) {
      const uploadPath = `${member.user_id}/current.pdf`;
      try {
        const base64 = await FileSystem.readAsStringAsync(picked.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const bytes = base64ToArrayBuffer(base64);
        const { error: uploadErr } = await supabase.storage
          .from('licenses')
          .upload(uploadPath, bytes, { contentType: 'application/pdf', upsert: true });
        if (uploadErr) {
          setErrorMessage(uploadErr.message);
          setMemberLicenseState(member.user_id, { saving: false });
          return;
        }
      } catch (uploadError) {
        const msg = uploadError instanceof Error ? uploadError.message : 'Upload nije uspeo.';
        setErrorMessage(msg);
        setMemberLicenseState(member.user_id, { saving: false });
        return;
      }
      finalPath = uploadPath;
    }

    const effectiveLicenseNumber = licenseNumber ?? member.license_number ?? null;

    const { error: rpcErr } = await supabase.rpc('upsert_user_license', {
      p_user_id: member.user_id,
      p_valid_until: validUntil,
      p_license_file_path: finalPath,
      p_license_number: effectiveLicenseNumber,
    });

    if (rpcErr) {
      const payload: Record<string, unknown> = {
        user_id: member.user_id,
        valid_until: validUntil,
        license_file_path: finalPath,
      };
      if (effectiveLicenseNumber != null) payload.license_number = effectiveLicenseNumber;
      const { error: fallbackErr } = await supabase
        .from('user_licenses')
        .upsert(payload, { onConflict: 'user_id' });
      if (fallbackErr) {
        setErrorMessage(fallbackErr.message);
        setMemberLicenseState(member.user_id, { saving: false });
        return;
      }
    }

    const updateRow = (row: TeamMember) =>
      row.user_id === member.user_id
        ? {
            ...row,
            license_valid_until: validUntil,
            license_file_path: finalPath,
            license_number: effectiveLicenseNumber,
          }
        : row;
    setPlayers((prev) => prev.map(updateRow));
    setTrainers((prev) => prev.map(updateRow));
    setMemberLicenseState(member.user_id, { saving: false, pickedFile: null });
  };

  const markPaid = async (playerId: string) => {
    setPayingPlayerId(playerId);
    setErrorMessage('');
    const { error } = await supabase.rpc('mark_player_fee_paid', { p_player_id: playerId });
    setPayingPlayerId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await loadTeam();
  };

  const payFullDebt = async (playerId: string) => {
    setPayingPlayerId(playerId);
    setErrorMessage('');
    const { error } = await supabase.rpc('pay_player_debt', {
      p_player_id: playerId,
      p_amount: null,
    });
    setPayingPlayerId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await loadTeam();
  };

  const openPartialDialog = (playerId: string) => {
    setPartialDialogPlayerId(playerId);
    setPartialDialogValue('');
    setPartialDialogOpen(true);
  };

  const savePartialPayment = async () => {
    if (!partialDialogPlayerId) return;
    const amount = Number(partialDialogValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Neispravan iznos', 'Unesi broj veci od 0.');
      return;
    }
    setPartialDialogSaving(true);
    const { error } = await supabase.rpc('pay_player_debt', {
      p_player_id: partialDialogPlayerId,
      p_amount: amount,
    });
    setPartialDialogSaving(false);
    if (error) {
      Alert.alert('Greska', error.message);
      return;
    }
    setPartialDialogOpen(false);
    setPartialDialogPlayerId(null);
    setPartialDialogValue('');
    await loadTeam();
  };

  const openFeeDialog = () => {
    setFeeDialogValue(monthlyFee != null ? String(monthlyFee) : '');
    setFeeDialogOpen(true);
  };

  const saveMonthlyFee = async () => {
    const amount = Number(feeDialogValue);
    if (!Number.isFinite(amount) || amount < 0) {
      Alert.alert('Neispravan iznos', 'Unesi broj veci ili jednak 0.');
      return;
    }
    setFeeDialogSaving(true);
    const { error } = await supabase.rpc('set_club_monthly_fee', { p_amount: amount });
    setFeeDialogSaving(false);
    if (error) {
      Alert.alert('Greska', error.message);
      return;
    }
    setMonthlyFee(amount);
    setFeeDialogOpen(false);
    await loadTeam();
  };

  const isPaid = (status?: string | null) => {
    if (!status) return false;
    return ['placeno', 'paid'].includes(status.toLowerCase());
  };

  const renderMemberCard = (member: TeamMember, showFees: boolean) => {
    const editState = licenseEdits[member.user_id] ?? {
      validUntil: member.license_valid_until ?? '',
      licenseNumber: member.license_number ?? '',
      pickedFile: null,
      saving: false,
    };

    return (
      <ThemedView key={member.user_id} style={styles.card}>
        <ThemedText type="defaultSemiBold">
          {member.display_name || [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Bez imena'}
        </ThemedText>
        <ThemedText>Username: {member.username ?? '-'}</ThemedText>
        {context?.leagueName ? <ThemedText>Liga: {context.leagueName}</ThemedText> : null}
        {context?.groupName ? <ThemedText>Grupa: {context.groupName}</ThemedText> : null}
        {context?.regionName ? <ThemedText>Regija: {context.regionName}</ThemedText> : null}

        {showFees ? (() => {
          const totalUnpaid = Number(member.total_unpaid ?? 0);
          const currentDue = Number(member.current_month_due ?? monthlyFee ?? 0);
          const statusPaid = isPaid(member.current_month_status ?? member.fee_status);
          const currentPaid = statusPaid || currentDue <= 0;
          const paying = payingPlayerId === member.user_id;
          return (
            <ThemedView style={[styles.feeBox, currentPaid && styles.feeBoxPaid]}>
              <ThemedText type="defaultSemiBold">Clanarina</ThemedText>
              <ThemedText>
                Trenutni mesec: {currentPaid ? 'PLACENO' : `duguje ${currentDue}`}
              </ThemedText>
              <ThemedText>Ukupan dug: {totalUnpaid}</ThemedText>
              {!currentPaid ? (
                <Pressable
                  style={[styles.primaryButton, paying && styles.buttonDisabled]}
                  onPress={() => markPaid(member.user_id)}
                  disabled={paying}>
                  {paying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>PLATIO (trenutni mesec)</ThemedText>
                  )}
                </Pressable>
              ) : null}
              {totalUnpaid > 0 ? (
                <>
                  <Pressable
                    style={[styles.primaryButton, paying && styles.buttonDisabled]}
                    onPress={() => payFullDebt(member.user_id)}
                    disabled={paying}>
                    {paying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>Platio ceo dug</ThemedText>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryButton, paying && styles.buttonDisabled]}
                    onPress={() => openPartialDialog(member.user_id)}
                    disabled={paying}>
                    <ThemedText style={styles.secondaryButtonText}>Platio deo duga</ThemedText>
                  </Pressable>
                </>
              ) : null}
            </ThemedView>
          );
        })() : null}

        <ThemedView style={styles.feeBox}>
          <ThemedText type="defaultSemiBold">Licenca</ThemedText>
          <ThemedText>Broj licence: {member.license_number ?? '-'}</ThemedText>
          <ThemedText>Trenutni PDF: {member.license_file_path ?? '-'}</ThemedText>
          {member.license_file_path ? (
            <Pressable style={styles.secondaryButton} onPress={() => openLicensePdf(member.license_file_path)}>
              <ThemedText style={styles.secondaryButtonText}>Otvori PDF</ThemedText>
            </Pressable>
          ) : null}
          <TextInput
            value={editState.licenseNumber}
            onChangeText={(text) => setMemberLicenseState(member.user_id, { licenseNumber: text })}
            placeholder="Broj licence"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={editState.validUntil}
            onChangeText={(text) => setMemberLicenseState(member.user_id, { validUntil: text })}
            placeholder="Vazi do (YYYY-MM-DD)"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <Pressable style={styles.secondaryButton} onPress={() => pickPdf(member.user_id)}>
            <ThemedText style={styles.secondaryButtonText}>
              {editState.pickedFile ? `PDF: ${editState.pickedFile.name}` : 'Izaberi PDF'}
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, editState.saving && styles.buttonDisabled]}
            onPress={() => saveLicense(member)}
            disabled={editState.saving}>
            {editState.saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Sacuvaj licencu</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Tim i clanarine</ThemedText>
      <ThemedText>Pregled igraca i trenera kluba sa licencama i statusom clanarina.</ThemedText>
      <Pressable style={styles.secondaryButton} onPress={loadTeam}>
        <ThemedText style={styles.secondaryButtonText}>Refresh</ThemedText>
      </Pressable>

      {context ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">{context.clubName}</ThemedText>
          <ThemedText>Liga: {context.leagueName ?? '-'}</ThemedText>
          <ThemedText>Grupa: {context.groupName ?? '-'}</ThemedText>
          <ThemedText>Regija: {context.regionName ?? '-'}</ThemedText>
          <ThemedText>Mesecna clanarina: {monthlyFee != null ? `${monthlyFee}` : 'nije postavljena'}</ThemedText>
          <Pressable style={styles.secondaryButton} onPress={openFeeDialog}>
            <ThemedText style={styles.secondaryButtonText}>Postavi mesecnu clanarinu</ThemedText>
          </Pressable>
        </ThemedView>
      ) : null}

      <Modal visible={feeDialogOpen} transparent animationType="fade" onRequestClose={() => setFeeDialogOpen(false)}>
        <ThemedView style={styles.modalBackdrop}>
          <ThemedView style={styles.modalCard}>
            <ThemedText type="defaultSemiBold">Mesecna clanarina kluba</ThemedText>
            <ThemedText>Iznos koji vazi za svakog igraca mesecno.</ThemedText>
            <TextInput
              value={feeDialogValue}
              onChangeText={setFeeDialogValue}
              placeholder="npr. 2000"
              placeholderTextColor="#888"
              keyboardType="numeric"
              style={styles.input}
            />
            <ThemedView style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setFeeDialogOpen(false)}
                disabled={feeDialogSaving}>
                <ThemedText style={styles.secondaryButtonText}>Otkazi</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, feeDialogSaving && styles.buttonDisabled]}
                onPress={saveMonthlyFee}
                disabled={feeDialogSaving}>
                {feeDialogSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Sacuvaj</ThemedText>
                )}
              </Pressable>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      <Modal
        visible={partialDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPartialDialogOpen(false)}>
        <ThemedView style={styles.modalBackdrop}>
          <ThemedView style={styles.modalCard}>
            <ThemedText type="defaultSemiBold">Delimicna uplata duga</ThemedText>
            <ThemedText>Iznos se oduzima od najstarijih dugovanja.</ThemedText>
            <TextInput
              value={partialDialogValue}
              onChangeText={setPartialDialogValue}
              placeholder="npr. 500"
              placeholderTextColor="#888"
              keyboardType="numeric"
              style={styles.input}
            />
            <ThemedView style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setPartialDialogOpen(false)}
                disabled={partialDialogSaving}>
                <ThemedText style={styles.secondaryButtonText}>Otkazi</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, partialDialogSaving && styles.buttonDisabled]}
                onPress={savePartialPayment}
                disabled={partialDialogSaving}>
                {partialDialogSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Sacuvaj</ThemedText>
                )}
              </Pressable>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      <ThemedView style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'igraci' && styles.tabButtonActive]}
          onPress={() => setActiveTab('igraci')}>
          <ThemedText style={activeTab === 'igraci' ? styles.tabButtonActiveText : undefined}>
            Igraci ({players.length})
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'treneri' && styles.tabButtonActive]}
          onPress={() => setActiveTab('treneri')}>
          <ThemedText style={activeTab === 'treneri' ? styles.tabButtonActiveText : undefined}>
            Treneri ({trainers.length})
          </ThemedText>
        </Pressable>
      </ThemedView>

      {activeTab === 'igraci' ? (
        <Pressable
          style={[styles.tabButton, onlyUnpaid && styles.tabButtonActive]}
          onPress={() => setOnlyUnpaid((v) => !v)}>
          <ThemedText style={onlyUnpaid ? styles.tabButtonActiveText : undefined}>
            {onlyUnpaid ? 'Prikaz: samo neplaceni' : 'Prikaz: svi igraci'}
          </ThemedText>
        </Pressable>
      ) : null}

      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && activeTab === 'igraci' && filteredPlayers.length === 0 ? (
        <ThemedText>Nema igraca za prikaz.</ThemedText>
      ) : null}
      {!loading && activeTab === 'treneri' && trainers.length === 0 ? (
        <ThemedText>Nema trenera za prikaz.</ThemedText>
      ) : null}

      {!loading && activeTab === 'igraci' ? filteredPlayers.map((p) => renderMemberCard(p, true)) : null}
      {!loading && activeTab === 'treneri' ? trainers.map((t) => renderMemberCard(t, false)) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  feeBox: { borderWidth: 1, borderColor: '#aaa', borderRadius: 8, padding: 8, gap: 4 },
  feeBoxPaid: { borderColor: '#2e7d32', backgroundColor: '#e8f5e9' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 10,
    padding: 16,
    gap: 10,
    backgroundColor: '#fff',
  },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  input: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#111',
    backgroundColor: '#fff',
  },
  tabRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tabButton: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabButtonActive: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  tabButtonActiveText: { color: '#fff', fontWeight: '600' },
  primaryButton: {
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryButtonText: { color: '#0a7ea4', fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  errorText: { color: '#c53939' },
});
