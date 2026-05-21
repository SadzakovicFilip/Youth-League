import { isSavezTakmicenjeDrillPath } from '@/lib/savez-takmicenje-drill';

export type ChromeLeftMode = 'drawer' | 'back';

export function normPath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '';
}

/**
 * Levo u AppChromeHeader: drawer samo na "korenu" tab navigacije uloge;
 * bilo koji drill-down → back.
 */
export function resolveChromeLeftMode(pathname: string): ChromeLeftMode {
  const p = normPath(pathname);

  if (/^\/klub(\/(index|tim|utakmice|takmicenje))?$/.test(p)) return 'drawer';
  if (/^\/delegat(\/(index|upravljaj-utakmicama|takmicenje))?$/.test(p)) return 'drawer';
  if (/^\/trener(\/(index|tim|utakmice|takmicenje))?$/.test(p)) return 'drawer';
  /** Tab Takmičenje / Utakmice; drill ispod Takmičenja nema glavni header (savez/_layout). */
  if (/^\/savez(\/utakmice)?$/.test(p)) return 'drawer';

  if (/^\/zapisnicar$/.test(p)) return 'drawer';
  if (/^\/sudija$/.test(p)) return 'drawer';
  if (/^\/igrac(\/index)?$/.test(p)) return 'drawer';
  if (/^\/admin$/.test(p)) return 'drawer';
  if (/^\/spectator$/.test(p)) return 'drawer';
  if (/^\/scout$/.test(p)) return 'drawer';

  return 'back';
}

export function isSavezUtakmicaDetailPath(pathname: string): boolean {
  const p = normPath(pathname);
  return /^\/savez\/utakmica(\/|$)/.test(p);
}

/** Glavni chrome (tab bar + header) sakriven za savez drill i detalj utakmice iz savez konteksta. */
export function hideSavezMainTabChrome(pathname: string): boolean {
  const p = normPath(pathname);
  return isSavezTakmicenjeDrillPath(p) || isSavezUtakmicaDetailPath(p);
}
