import { MemberCreateForm } from '@/components/klub/member-create-form';

export default function KlubDodajIgracaScreen() {
  return (
    <MemberCreateForm
      targetRole="igrac"
      title="Dodaj igraca"
      description="Klub direktno kreira igraca i automatski ga vezuje za svoj tim (klub)."
    />
  );
}
