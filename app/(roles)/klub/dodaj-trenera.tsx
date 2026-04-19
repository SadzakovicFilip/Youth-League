import { MemberCreateForm } from '@/components/klub/member-create-form';

export default function KlubDodajTreneraScreen() {
  return (
    <MemberCreateForm
      targetRole="trener"
      title="Dodaj trenera"
      description="Klub direktno kreira trenera i automatski ga vezuje za svoj tim (klub)."
    />
  );
}
