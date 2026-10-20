// The live office server: tails office/.runtime/events.jsonl and streams it to the page (SSE).
// Read-only observer: it never touches the team's tools, client files or anything that goes live.
// Local only: listens on 127.0.0.1, never on the network.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadRoster } from './lib/roster.js';
import { LOG_FILE, AGENTS_DIR, OFFICE_DIR } from './lib/eventlog.js';

const PAGE_FILE = path.join(OFFICE_DIR, 'public', 'office.html');
const REPLAY_MAX = 400;
const HEARTBEAT_MS = 15000;

// Follows a growing file from its current end. Handles partial lines, truncation and a missing file.
class Tailer {
  constructor(file, onLine) {
    this.file = file;
    this.onLine = onLine;
    this.partial = '';
    this.offset = this.size(); // trap 8: start from the END - never replay yesterday.
  }

  size() {
    try { return fs.statSync(this.file).size; } catch { return 0; }
  }

  poll() {
    const size = this.size();
    if (size < this.offset) { // rotated or truncated: start over from the top of the new file
      this.offset = 0;
      this.partial = '';
    }
    if (size === this.offset) return;
    const len = size - this.offset;
    const buf = Buffer.alloc(len);
    let fd;
    let n = 0;
    try { // trap 6: always close, even when the read fails
      fd = fs.openSync(this.file, 'r');
      n = fs.readSync(fd, buf, 0, len, this.offset);
    } catch {
      return; // transient failure - try again next tick
    } finally {
      if (fd !== undefined) try { fs.closeSync(fd); } catch {}
    }
    this.offset += n;
    const text = this.partial + buf.subarray(0, n).toString('utf8');
    const lines = text.split('\n');
    this.partial = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try { this.onLine(JSON.parse(line)); } catch {}
    }
  }
}

export function createOfficeServer({ logFile = LOG_FILE, agentsDir = AGENTS_DIR, port = 4777, pollMs = 200, pageFile = PAGE_FILE } = {}) {
  const clients = new Set();
  let replay = []; // events of the current turn, so a page reloaded mid-show catches up

  const send = (res, event, data) => {
    try { // trap 5: each write on its own - one dead tab must not take the others down
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch {
      clients.delete(res);
      return false;
    }
  };

  const tailer = new Tailer(logFile, (ev) => {
    if (!ev || typeof ev !== 'object' || !ev.type) return;
    if (ev.type === 'request') replay = [];
    replay.push(ev);
    if (replay.length > REPLAY_MAX) replay = replay.slice(-REPLAY_MAX);
    for (const res of [...clients]) send(res, 'office', ev);
  });
  const pollTimer = setInterval(() => { try { tailer.poll(); } catch {} }, pollMs);
  const beatTimer = setInterval(() => {
    for (const res of [...clients]) {
      try { res.write(': ping\n\n'); } catch { clients.delete(res); }
    }
  }, HEARTBEAT_MS);

  const server = http.createServer((req, res) => {
    res.on('error', () => clients.delete(res));
    req.on('error', () => {});
    const url = (req.url || '/').split('?')[0];
    try {
      if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
        fs.readFile(pageFile, (err, html) => {
          if (err) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('office.html missing'); return; }
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
          res.end(html);
        });
        return;
      }
      if (req.method === 'GET' && url === '/events') {
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-store',
          connection: 'keep-alive',
        });
        res.write('retry: 1500\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        send(res, 'hello', { roster: loadRoster(agentsDir), replay });
        return;
      }
      if (req.method === 'GET' && url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, clients: clients.size, log: logFile }));
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    } catch {
      try { res.writeHead(500); res.end(); } catch {}
    }
  });
  server.on('clientError', (err, socket) => { try { socket.destroy(); } catch {} });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { // trap 7: local machine only
      server.off('error', reject);
      server.on('error', () => {});
      server.stop = () => new Promise((done) => {
        clearInterval(pollTimer);
        clearInterval(beatTimer);
        for (const res of clients) try { res.end(); } catch {}
        clients.clear();
        server.close(() => done());
        server.closeAllConnections?.();
      });
      resolve(server);
    });
  });
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  try { exec(cmd, () => {}); } catch {}
}

async function main() {
  const port = Number(process.env.OFFICE_PORT) || 4777;
  const url = `http://127.0.0.1:${port}/`;
  process.on('uncaughtException', (e) => console.error('[משרד] שגיאה (השרת ממשיך לרוץ):', e?.message || e));
  try {
    await createOfficeServer({ port });
  } catch (e) {
    if (e?.code === 'EADDRINUSE') {
      console.log(`המשרד כבר פתוח בחלון אחר: ${url}`);
      if (process.argv.includes('--open')) openBrowser(url);
      return;
    }
    throw e;
  }
  console.log('');
  console.log('  🏢  המשרד החי פתוח:  ' + url);
  console.log('  עכשיו פותחים שיחה חדשה בקלוד קוד וכותבים בקשה רגילה.');
  console.log('  לסגירה: Ctrl+C');
  console.log('');
  if (process.argv.includes('--open')) openBrowser(url);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
