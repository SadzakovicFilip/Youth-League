import { MemberCreateForm } from '@/components/klub/member-create-form';

export default function KlubDodajZapisnicaraScreen() {
  return (
    <MemberCreateForm
      targetRole="zapisnicar"
      title="Dodaj zapisnicara"
      description="Klub kreira zapisnicara koji moze biti dodeljen domacim utakmicama."
    />
  );
}
