import { Redirect } from 'expo-router';

/** Stara ruta — sadržaj je na tabu Utakmice. */
export default function DelegatLigeRedirect() {
  return <Redirect href="/delegat/upravljaj-utakmicama" />;
}
