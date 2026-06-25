/**
 * Zamena jednog <ScrollView> po fajlu sa RefreshableScrollView u app/.
 * Izostavlja zapisnicar/utakmica/[id].tsx (više ScrollView + ref tip).
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

function stripScrollViewImport(s) {
  return s.replace(/import\s*\{([^}]+)\}\s*from\s*['"]react-native['"]/g, (m, inner) => {
    if (!/\bScrollView\b/.test(inner)) return m;
    const parts = inner
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x && x !== 'ScrollView');
    return `import { ${parts.join(', ')} } from 'react-native'`;
  });
}

const files = walk(ROOT).filter((f) => !f.includes(path.join('zapisnicar', 'utakmica', '[id].tsx')));

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes('ScrollView')) continue;
  if (s.includes('RefreshableScrollView')) continue;

  const openCount = (s.match(/<ScrollView\b/g) || []).length;
  if (openCount !== 1) {
    console.warn('SKIP', path.relative(process.cwd(), file), 'ScrollView tags=', openCount);
    continue;
  }

  s = s.replace(/<ScrollView\b/g, '<RefreshableScrollView');
  s = s.replace(/<\/ScrollView>/g, '</RefreshableScrollView>');
  s = stripScrollViewImport(s);

  if (!s.includes("refreshable-scroll-view")) {
    s = s.replace(
      /(from\s+['"]react-native['"];)/,
      "$1\nimport { RefreshableScrollView } from '@/components/refreshable-scroll-view';",
    );
  }

  fs.writeFileSync(file, s);
  console.log('OK', path.relative(process.cwd(), file));
}

console.log('done');
