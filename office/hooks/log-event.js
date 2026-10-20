// Claude Code hook -> one line in office/.runtime/events.jsonl.
// Iron rule: never prints, never throws, always exits 0. It runs inside the real work.
let done = false;
const finish = () => {
  if (done) return;
  done = true;
  process.exit(0);
};
process.on('uncaughtException', finish);
process.on('unhandledRejection', finish);
setTimeout(finish, 3000); // stdin never closed? leave anyway.

let buf = '';
try {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { buf += c; });
  process.stdin.on('error', finish);
  process.stdin.on('end', async () => {
    try {
      const { translate } = await import('../lib/translate.js');
      const { loadGenders } = await import('../lib/roster.js');
      const { appendEvent, AGENTS_DIR } = await import('../lib/eventlog.js');
      const event = translate(JSON.parse(buf), loadGenders(AGENTS_DIR));
      if (event) appendEvent(event);
    } catch {}
    finish();
  });
} catch {
  finish();
}
