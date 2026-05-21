import { Redirect } from 'expo-router';

/** Stara ruta — sadržaj je na početnom tabu delegata. */
export default function DelegatLigeRedirect() {
  return <Redirect href="/delegat" />;
}
