// Calibration only: append the raw hook payload (as-is) to a JSONL file.
// Never prints, never throws, always exits 0.
import fs from 'node:fs';

const out = process.argv[2];
let buf = '';
try {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { buf += c; });
  process.stdin.on('end', () => {
    try {
      fs.appendFileSync(out, JSON.stringify({ t: Date.now(), raw: buf }) + '\n');
    } catch {}
    process.exit(0);
  });
  process.stdin.on('error', () => process.exit(0));
} catch {
  process.exit(0);
}
