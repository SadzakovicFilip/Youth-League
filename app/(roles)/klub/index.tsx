import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { MemberCreateForm } from '@/components/klub/member-create-form';
import { SavezLeagueAccordionSection } from '@/components/savez/savez-league-accordion-section';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import {
  fetchKlubClubMembersByRole,
  type KlubMemberLine,
} from '@/lib/fetch-klub-club-members';
import { personDisplayName } from '@/lib/person-display-name';

function MemberUsernameRow({ line }: { line: KlubMemberLine }) {
  const label = personDisplayName(line);
  return (
    <Pressable
      style={styles.userRow}
      onPress={() => router.push(`/klub/korisnik/${line.user_id}` as never)}
      accessibilityRole="link"
      accessibilityLabel={`Profil: ${label}`}>
      <ThemedText numberOfLines={2}>{label}</ThemedText>
    </Pressable>
  );
}

function UsernameList({
  lines,
  emptyLabel,
}: {
  lines: KlubMemberLine[];
  emptyLabel: string;
}) {
  if (lines.length === 0) {
    return <ThemedText style={styles.muted}>{emptyLabel}</ThemedText>;
  }
  return (
    <ThemedView style={styles.listBlock}>
      {lines.map((line) => (
        <MemberUsernameRow key={line.user_id} line={line} />
      ))}
    </ThemedView>
  );
}

export default function KlubUpravljanjeScreen() {
  const [openIgracList, setOpenIgracList] = useState(false);
  const [igracFormOpen, setIgracFormOpen] = useState(false);
  const [openTrenerList, setOpenTrenerList] = useState(false);
  const [trenerFormOpen, setTrenerFormOpen] = useState(false);
  const [openZapisnicarList, setOpenZapisnicarList] = useState(false);
  const [zapisnicarFormOpen, setZapisnicarFormOpen] = useState(false);

  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [players, setPlayers] = useState<KlubMemberLine[]>([]);
  const [trainers, setTrainers] = useState<KlubMemberLine[]>([]);
  const [zapisnicari, setZapisnicari] = useState<KlubMemberLine[]>([]);

  const loadMembers = useCallback(async () => {
    setListLoading(true);
    setListError('');
    const { players: p, trainers: t, zapisnicari: z, error } =
      await fetchKlubClubMembersByRole();
    if (error) {
      setListError(error);
      setPlayers([]);
      setTrainers([]);
      setZapisnicari([]);
    } else {
      setPlayers(p);
      setTrainers(t);
      setZapisnicari(z);
    }
    setListLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [loadMembers]),
  );

  useScreenPullRefresh(loadMembers);

  const closeOtherForms = (which: 'igrac' | 'trener' | 'zapisnicar') => {
    if (which !== 'igrac') setIgracFormOpen(false);
    if (which !== 'trener') setTrenerFormOpen(false);
    if (which !== 'zapisnicar') setZapisnicarFormOpen(false);
  };

  return (
    <ScreenShell>
      <RefreshableScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        {listLoading ? <ActivityIndicator style={styles.loader} /> : null}
        {listError ? <ThemedText style={styles.errorText}>{listError}</ThemedText> : null}

        <SavezLeagueAccordionSection
          title="Igrač"
          count={players.length}
          listExpanded={openIgracList}
          onToggleList={() => setOpenIgracList((v) => !v)}
          formOpen={igracFormOpen}
          onToggleForm={() => {
            if (igracFormOpen) {
              setIgracFormOpen(false);
            } else {
              closeOtherForms('igrac');
              setIgracFormOpen(true);
            }
          }}
          addLabel="Dodaj"
          closeFormLabel="Zatvori"
          form={
            <MemberCreateForm
              embedded
              targetRole="igrac"
              title="Dodaj igrača"
              description="Kreiraš nalog igrača i vezuješ ga za ovaj klub."
              onCreated={() => {
                setIgracFormOpen(false);
                void loadMembers();
              }}
            />
          }>
          <UsernameList lines={players} emptyLabel="Nema igrača." />
        </SavezLeagueAccordionSection>

        <SavezLeagueAccordionSection
          title="Trener"
          count={trainers.length}
          listExpanded={openTrenerList}
          onToggleList={() => setOpenTrenerList((v) => !v)}
          formOpen={trenerFormOpen}
          onToggleForm={() => {
            if (trenerFormOpen) {
              setTrenerFormOpen(false);
            } else {
              closeOtherForms('trener');
              setTrenerFormOpen(true);
            }
          }}
          addLabel="Dodaj"
          closeFormLabel="Zatvori"
          form={
            <MemberCreateForm
              embedded
              targetRole="trener"
              title="Dodaj trenera"
              description="Kreiraš nalog trenera i vezuješ ga za ovaj klub."
              onCreated={() => {
                setTrenerFormOpen(false);
                void loadMembers();
              }}
            />
          }>
          <UsernameList lines={trainers} emptyLabel="Nema trenera." />
        </SavezLeagueAccordionSection>

        <SavezLeagueAccordionSection
          title="Zapisničar"
          count={zapisnicari.length}
          listExpanded={openZapisnicarList}
          onToggleList={() => setOpenZapisnicarList((v) => !v)}
          formOpen={zapisnicarFormOpen}
          onToggleForm={() => {
            if (zapisnicarFormOpen) {
              setZapisnicarFormOpen(false);
            } else {
              closeOtherForms('zapisnicar');
              setZapisnicarFormOpen(true);
            }
          }}
          addLabel="Dodaj"
          closeFormLabel="Zatvori"
          form={
            <MemberCreateForm
              embedded
              targetRole="zapisnicar"
              title="Dodaj zapisničara"
              description="Kreiraš nalog zapisničara za dodelu na domaće utakmice."
              onCreated={() => {
                setZapisnicarFormOpen(false);
                void loadMembers();
              }}
            />
          }>
          <UsernameList lines={zapisnicari} emptyLabel="Nema zapisničara." />
        </SavezLeagueAccordionSection>
      </RefreshableScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 32 },
  loader: { marginVertical: 4 },
  errorText: { color: '#c53939', fontSize: 14 },
  listBlock: { gap: 0 },
  userRow: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.35)',
  },
  muted: { opacity: 0.85, fontSize: 13 },
});
