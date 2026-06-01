import { Redirect } from 'expo-router';

/** Stari početni tab — preusmeri na Utakmice. */
export default function DelegatIndexRedirect() {
  return <Redirect href="/delegat/upravljaj-utakmicama" />;
}
