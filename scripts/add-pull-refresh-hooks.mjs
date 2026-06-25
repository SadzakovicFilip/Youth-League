/**
 * Dodaje useScreenPullRefresh(imeLoadera) u fajlove koji već imaju RefreshableScrollView.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'app');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const PAIRS = [
  ['const load = useCallback', 'load'],
  ['const loadAll = useCallback', 'loadAll'],
  ['const loadData = useCallback', 'loadData'],
  ['const loadPlayerData = useCallback', 'loadPlayerData'],
];

for (const file of walk(ROOT)) {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes('RefreshableScrollView')) continue;
  if (s.includes('useScreenPullRefresh')) continue;

  let name = null;
  for (const [needle, n] of PAIRS) {
    if (s.includes(needle)) {
      name = n;
      break;
    }
  }
  if (!name) continue;

  if (!s.includes("from '@/contexts/screen-pull-refresh-context'")) {
    s = s.replace(
      /(from\s+['"]expo-router['"];)/,
      "$1\nimport { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';",
    );
    if (!s.includes("screen-pull-refresh-context")) {
      s = s.replace(
        /(from\s+['"]react['"];)/,
        "$1\nimport { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';",
      );
    }
  }

  const hookLine = `  useScreenPullRefresh(${name});\n\n`;
  const idx = s.indexOf('\n  return (');
  if (idx === -1) {
    console.warn('NO return (', file);
    continue;
  }
  s = s.slice(0, idx + 1) + hookLine + s.slice(idx + 1);

  fs.writeFileSync(file, s);
  console.log('HOOK', path.relative(process.cwd(), file), name);
}

console.log('done');
