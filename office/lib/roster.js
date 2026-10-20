// The office cast: one robot per agent in .claude/agents/, plus two fixed characters:
//   lead   - the main chat (every real handoff starts there - see calibration/NOTES.md)
//   helper - any agent that is not in the folder (Explore, general-purpose, plugin agents...)
import fs from 'node:fs';
import path from 'node:path';

// Distinct, saturated colors that pop on a white office. Order = desk order.
const PALETTE = [
  '#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#38D9A9', '#3BC9DB',
  '#4DABF7', '#748FFC', '#DA77F2', '#F783AC', '#A9E34B', '#FF8787',
  '#63E6BE', '#FFC078', '#91A7FF', '#E599F7',
];
const LEAD = { key: 'lead', name: 'lead', title: 'ראש הצוות', gender: 'm', color: '#7048E8', icon: '🧠', dept: 'lead' };
const HELPER = { key: 'helper', name: 'helper', title: 'עוזר כללי', gender: 'm', color: '#868E96', icon: '🛠️', dept: 'helper' };

const ICONS = [
  [/organic-analyst|analyst|report/, '📊'],
  [/strateg/, '🧭'],
  [/campaign|upload/, '🚀'],
  [/copy|writer/, '✍️'],
  [/photo|creative|image/, '📷'],
  [/plan|calendar/, '🗓️'],
  [/publish|schedul/, '📤'],
  [/manager|ceo/, '👔'],
];

// Read only the head of the file: enough for frontmatter + first body line.
function readHead(file, bytes = 4096) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n).toString('utf8');
  } catch {
    return '';
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
  }
}

function parseAgent(text, fallbackName) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const front = m ? m[1] : '';
  const body = m ? m[2] : text;
  const field = (k) => (front.match(new RegExp('^' + k + ':\\s*(.*)$', 'm')) || [])[1]?.trim() || '';
  const name = field('name') || fallbackName;
  const desc = field('description');
  let title = (desc.split('.')[0] || name).trim();
  if (title.length > 28) title = title.slice(0, 27) + '…';
  const firstLine = (body.split(/\r?\n/).find((l) => l.trim()) || '').trim();
  const gender = /^את\s/.test(firstLine) ? 'f' : 'm';
  return { name, title, gender };
}

function deptOf(name) {
  if (/^ads-/.test(name)) return 'paid';
  if (/content|photo|publish|organic/.test(name)) return 'organic';
  return 'mgmt';
}

function iconOf(name) {
  for (const [re, icon] of ICONS) if (re.test(name)) return icon;
  return '🤖';
}

export function agentFiles(agentsDir) {
  try {
    return fs.readdirSync(agentsDir)
      .filter((f) => f.toLowerCase().endsWith('.md') && f.toLowerCase() !== 'readme.md')
      .sort();
  } catch {
    return [];
  }
}

// Full cast for the page.
export function loadRoster(agentsDir) {
  const agents = agentFiles(agentsDir).map((f) => {
    const a = parseAgent(readHead(path.join(agentsDir, f)), f.replace(/\.md$/i, ''));
    return { key: a.name, name: a.name, title: a.title, gender: a.gender, icon: iconOf(a.name), dept: deptOf(a.name) };
  });
  const order = { mgmt: 0, paid: 1, organic: 2 };
  agents.sort((a, b) => order[a.dept] - order[b.dept] || a.name.localeCompare(b.name));
  agents.forEach((a, i) => { a.color = PALETTE[i % PALETTE.length]; });
  return [{ ...LEAD }, ...agents, { ...HELPER }];
}

// Light version for the hook: { agentName: 'm' | 'f' }.
export function loadGenders(agentsDir) {
  const out = {};
  for (const f of agentFiles(agentsDir)) {
    const a = parseAgent(readHead(path.join(agentsDir, f), 2048), f.replace(/\.md$/i, ''));
    out[a.name] = a.gender;
  }
  return out;
}
