/** Putanje ispod /savez koje pripadaju drilldown-u iz taba Takmičenje (bez /savez, /savez/utakmice, …). */
const SAVEZ_TAKMICENJE_DRILL_RE = /^\/savez\/(regija|liga|grupa|klub|korisnik|sudija)(\/|$)/;

export function isSavezTakmicenjeDrillPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '';
  return SAVEZ_TAKMICENJE_DRILL_RE.test(p);
}
