// טוען את קובץ .env (הכספת) בלי שום תלות חיצונית.
// אין להדפיס ערכים מכאן החוצה - רק לבדוק שהם קיימים.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return false;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (value && !process.env[m[1]]) process.env[m[1]] = value;
  }
  return true;
}

export function readSafety() {
  const raw = readFileSync(join(ROOT, 'config', 'safety.json'), 'utf8');
  return JSON.parse(raw);
}

// עוזר קטן לפלט עברי נעים בטרמינל
export const ok = (msg) => console.log(`✅ ${msg}`);
export const bad = (msg) => console.log(`❌ ${msg}`);
export const warn = (msg) => console.log(`🟡 ${msg}`);
export const info = (msg) => console.log(`   ${msg}`);
export const title = (msg) => console.log(`\n=== ${msg} ===`);
