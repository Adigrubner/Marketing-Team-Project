import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createOfficeServer } from '../server.js';

function tmpLog(lines = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-srv-'));
  const file = path.join(dir, 'events.jsonl');
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l) + '\n').join(''));
  return file;
}

// Minimal SSE client: collects parsed `data:` payloads per event name.
function sse(port) {
  const got = [];
  let req;
  const ready = new Promise((resolve, reject) => {
    req = http.get({ host: '127.0.0.1', port, path: '/events' }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        buf += c;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const ev = (block.match(/^event: (.*)$/m) || [])[1] || 'message';
          const data = (block.match(/^data: (.*)$/m) || [])[1];
          if (data) got.push({ ev, data: JSON.parse(data) });
        }
      });
      res.on('error', () => {});
      resolve(res);
    });
    req.on('error', reject);
  });
  return { got, ready, close: () => req.destroy() };
}

const until = async (fn, ms = 3000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 30));
  }
  return false;
};

test('listens on 127.0.0.1 only', async () => {
  const s = await createOfficeServer({ logFile: tmpLog(), port: 0, pollMs: 50 });
  try {
    assert.equal(s.address().address, '127.0.0.1');
  } finally { await s.stop(); }
});

test('starts reading the log from the END (old lines are not replayed)', async () => {
  const file = tmpLog([{ ts: 1, type: 'request', text: 'yesterday' }]);
  const s = await createOfficeServer({ logFile: file, port: 0, pollMs: 50 });
  const c = sse(s.address().port);
  try {
    await c.ready;
    await until(() => c.got.some((g) => g.ev === 'hello'));
    fs.appendFileSync(file, JSON.stringify({ ts: 2, type: 'request', text: 'today' }) + '\n');
    assert.ok(await until(() => c.got.some((g) => g.ev === 'office')));
    const texts = c.got.filter((g) => g.ev === 'office').map((g) => g.data.text);
    assert.deepEqual(texts, ['today']);
  } finally { c.close(); await s.stop(); }
});

test('hello carries the roster and the replay of the current turn', async () => {
  const file = tmpLog();
  const s = await createOfficeServer({ logFile: file, port: 0, pollMs: 50 });
  try {
    fs.appendFileSync(file, [
      { ts: 1, type: 'request', text: 'a' },
      { ts: 2, type: 'turn_end' },
      { ts: 3, type: 'request', text: 'b' },
      { ts: 4, type: 'handoff', from: 'lead', to: 'helper' },
    ].map((l) => JSON.stringify(l) + '\n').join(''));
    await new Promise((r) => setTimeout(r, 200));
    const c = sse(s.address().port);
    await c.ready;
    await until(() => c.got.some((g) => g.ev === 'hello'));
    const hello = c.got.find((g) => g.ev === 'hello').data;
    assert.ok(Array.isArray(hello.roster) && hello.roster.some((a) => a.key === 'lead'));
    assert.deepEqual(hello.replay.map((e) => e.ts), [3, 4]);
    c.close();
  } finally { await s.stop(); }
});

test('a line written in two chunks is delivered once, whole', async () => {
  const file = tmpLog();
  const s = await createOfficeServer({ logFile: file, port: 0, pollMs: 40 });
  const c = sse(s.address().port);
  try {
    await c.ready;
    const line = JSON.stringify({ ts: 9, type: 'action', agent: 'lead', label: 'קורא קובץ: brief.md' });
    fs.appendFileSync(file, line.slice(0, 20));
    await new Promise((r) => setTimeout(r, 150));
    fs.appendFileSync(file, line.slice(20) + '\n');
    assert.ok(await until(() => c.got.some((g) => g.ev === 'office')));
    const office = c.got.filter((g) => g.ev === 'office');
    assert.equal(office.length, 1);
    assert.equal(office[0].data.label, 'קורא קובץ: brief.md');
  } finally { c.close(); await s.stop(); }
});

test('closing a tab mid-stream does not crash the server', async () => {
  const file = tmpLog();
  const s = await createOfficeServer({ logFile: file, port: 0, pollMs: 20 });
  try {
    for (let i = 0; i < 5; i++) {
      const c = sse(s.address().port);
      await c.ready;
      fs.appendFileSync(file, JSON.stringify({ ts: i, type: 'action', agent: 'lead', label: 'x'.repeat(2000) }) + '\n');
      c.close();
    }
    await new Promise((r) => setTimeout(r, 200));
    const c2 = sse(s.address().port);
    await c2.ready;
    fs.appendFileSync(file, JSON.stringify({ ts: 99, type: 'turn_end' }) + '\n');
    assert.ok(await until(() => c2.got.some((g) => g.ev === 'office' && g.data.ts === 99)));
    c2.close();
  } finally { await s.stop(); }
});

test('log rotation / truncation is followed', async () => {
  const file = tmpLog();
  const s = await createOfficeServer({ logFile: file, port: 0, pollMs: 40 });
  const c = sse(s.address().port);
  try {
    await c.ready;
    fs.appendFileSync(file, JSON.stringify({ ts: 1, type: 'request', text: 'x'.repeat(300) }) + '\n');
    await until(() => c.got.some((g) => g.ev === 'office'));
    fs.writeFileSync(file, JSON.stringify({ ts: 2, type: 'turn_end' }) + '\n');
    assert.ok(await until(() => c.got.some((g) => g.ev === 'office' && g.data.ts === 2)));
  } finally { c.close(); await s.stop(); }
});

test('missing log file is fine, and it is picked up once created', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-srv-'));
  const file = path.join(dir, 'events.jsonl');
  const s = await createOfficeServer({ logFile: file, port: 0, pollMs: 40 });
  const c = sse(s.address().port);
  try {
    await c.ready;
    await new Promise((r) => setTimeout(r, 100));
    fs.writeFileSync(file, JSON.stringify({ ts: 5, type: 'turn_end' }) + '\n');
    assert.ok(await until(() => c.got.some((g) => g.ev === 'office' && g.data.ts === 5)));
  } finally { c.close(); await s.stop(); }
});

test('a second server on a busy port fails cleanly and leaves nothing running', async () => {
  const { spawn } = await import('node:child_process');
  const serverUrl = new URL('../server.js', import.meta.url).href;
  const code = `
    const { createOfficeServer } = await import(${JSON.stringify(serverUrl)});
    const a = await createOfficeServer({ port: 0, pollMs: 50 });
    try { await createOfficeServer({ port: a.address().port, pollMs: 50 }); } catch (e) { console.log(e.code); }
    await a.stop();`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (c) => { out += c; });
  const exited = await new Promise((resolve) => {
    const t = setTimeout(() => { child.kill(); resolve(false); }, 5000);
    child.on('exit', () => { clearTimeout(t); resolve(true); });
  });
  assert.match(out, /EADDRINUSE/);
  assert.ok(exited, 'process kept running after the failed second server (leaked timers)');
});

test('serves the page and 404s everything else', async () => {
  const s = await createOfficeServer({ logFile: tmpLog(), port: 0, pollMs: 50 });
  const get = (p) => new Promise((resolve) => http.get({ host: '127.0.0.1', port: s.address().port, path: p }, (res) => {
    let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => resolve({ status: res.statusCode, body: b, type: res.headers['content-type'] }));
  }));
  try {
    const page = await get('/');
    assert.equal(page.status, 200);
    assert.match(page.type, /text\/html/);
    assert.equal((await get('/../.env')).status, 404);
    assert.equal((await get('/nope')).status, 404);
  } finally { await s.stop(); }
});
