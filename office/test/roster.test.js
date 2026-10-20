import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRoster } from '../lib/roster.js';

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-roster-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

test('reads agents from .md frontmatter, skips README, adds lead + helper', () => {
  const dir = fixture({
    'README.md': '# team',
    'content-planner.md': '---\nname: content-planner\ndescription: מתכננת התוכן האורגני. בונה לוח.\n---\n\nאת מתכננת התוכן.',
    'ads-analyst.md': '---\nname: ads-analyst\ndescription: האנליסט של הממומן. מושך נתונים.\n---\n\nאתה האנליסט.',
  });
  const r = loadRoster(dir);
  const keys = r.map((a) => a.key);
  assert.deepEqual(keys.slice(0, 1), ['lead']);
  assert.ok(keys.includes('content-planner'));
  assert.ok(keys.includes('ads-analyst'));
  assert.equal(keys.at(-1), 'helper');
  assert.ok(!keys.includes('README'));
  const cp = r.find((a) => a.key === 'content-planner');
  assert.equal(cp.title, 'מתכננת התוכן האורגני');
  assert.equal(cp.gender, 'f');
  assert.equal(r.find((a) => a.key === 'ads-analyst').gender, 'm');
  // every agent gets a distinct color
  assert.equal(new Set(r.map((a) => a.color)).size, r.length);
});

test('missing agents folder still gives lead + helper', () => {
  const r = loadRoster(path.join(os.tmpdir(), 'no-such-dir-' + Date.now()));
  assert.deepEqual(r.map((a) => a.key), ['lead', 'helper']);
});
