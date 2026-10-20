// Where the office keeps its runtime files, and how events get appended.
// Runtime files live in office/.runtime/ and are git-ignored.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OFFICE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECT_DIR = path.resolve(OFFICE_DIR, '..');
export const AGENTS_DIR = path.join(PROJECT_DIR, '.claude', 'agents');
export const RUNTIME_DIR = path.join(OFFICE_DIR, '.runtime');
export const LOG_FILE = path.join(RUNTIME_DIR, 'events.jsonl');

const MAX_LOG_BYTES = 2 * 1024 * 1024;

export function appendEvent(event, file = LOG_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    if (fs.statSync(file).size > MAX_LOG_BYTES) fs.renameSync(file, file.replace(/\.jsonl$/, '.old.jsonl'));
  } catch {}
  fs.appendFileSync(file, JSON.stringify({ ts: Date.now(), ...event }) + '\n');
}
