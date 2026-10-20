// Raw Claude Code hook payload -> one simple office event (or null).
// Five event types only: request, handoff, action, done, turn_end.
// Field names come from calibration/NOTES.md - check there before changing anything.

const AGENT_TOOLS = new Set(['Agent', 'Task']);
const MAX_LABEL = 46;

// [masculine, feminine]
const V = {
  read: ['קורא', 'קוראת'],
  look: ['מסתכל', 'מסתכלת'],
  write: ['כותב', 'כותבת'],
  update: ['מעדכן', 'מעדכנת'],
  search: ['מחפש', 'מחפשת'],
  run: ['מריץ', 'מריצה'],
  check: ['בודק', 'בודקת'],
  prepare: ['מכין', 'מכינה'],
  create: ['יוצר', 'יוצרת'],
  edit: ['עורך', 'עורכת'],
  save: ['שומר', 'שומרת'],
  activate: ['מפעיל', 'מפעילה'],
  ask: ['שואל', 'שואלת'],
  schedule: ['מתזמן', 'מתזמנת'],
  pull: ['מושך', 'מושכת'],
  download: ['מוריד', 'מורידה'],
  browse: ['גולש', 'גולשת'],
  generate: ['מייצר', 'מייצרת'],
  plan: ['מתכנן', 'מתכננת'],
  work: ['עובד', 'עובדת'],
  wait: ['ממתין', 'ממתינה'],
};

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|tiff?|bmp|avif)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

function clip(s, n) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function base(p) {
  const s = String(p ?? '').replace(/[\\/]+$/, '');
  return s.split(/[\\/]/).pop() || s;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function describeCommand(cmd, v) {
  const c = String(cmd ?? '');
  if (/meta-report/.test(c)) return `${v('run')} דוח ביצועים`;
  if (/meta-upload/.test(c)) return /--confirm/.test(c) ? `${v('create')} מודעות ב-Meta (מושהות)` : `${v('check')} העלאה ל-Meta (ניסיון)`;
  if (/doctor/.test(c)) return `${v('check')} חיבורים`;
  if (/ffmpeg|build-reel|reel/.test(c)) return `${v('edit')} וידאו`;
  if (/sharp|magick|crop/.test(c)) return `${v('edit')} תמונה`;
  if (/^\s*git\b/.test(c)) return `${v('save')} גיבוי`;
  if (/--test|\bnpm (run )?test\b/.test(c)) return `${v('run')} בדיקות`;
  if (/\b(ls|dir|Get-ChildItem)\b/.test(c)) return `${v('look')} בתיקייה`;
  return `${v('run')} פקודה`;
}

function describeMcp(tool, v) {
  const t = tool.split('__').pop() || '';
  const rules = [
    [/createScheduledPost|updateScheduledPost/, `${v('schedule')} פוסט במטריקול`],
    [/ScheduledPost/, `${v('check')} פוסטים מתוזמנים`],
    [/Analytics|BestTime/, `${v('pull')} נתונים ממטריקול`],
    [/BrandSettings/, `${v('read')} הגדרות מותג`],
    [/search_files|list_recent_files|get_file_metadata/, `${v('search')} בגוגל דרייב`],
    [/download_file_content|read_file_content/, `${v('download')} קובץ מהדרייב`],
    [/generate-image|generate-design|create-design/, `${v('generate')} עיצוב`],
    [/navigate|get_page_text|read_page|computer|find|screenshot/, `${v('browse')} בדפדפן`],
  ];
  for (const [re, label] of rules) if (re.test(t)) return label;
  if (/browser|chrome/i.test(tool)) return `${v('browse')} בדפדפן`;
  return `${v('work')} עם כלי חיצוני`;
}

export function describe(tool, input, gender) {
  const g = gender === 'f' ? 1 : 0;
  const v = (k) => V[k][g];
  const i = input && typeof input === 'object' ? input : {};
  switch (tool) {
    case 'Read': {
      const f = base(i.file_path);
      if (IMAGE_EXT.test(f)) return `${v('look')} על תמונה: ${f}`;
      return `${v('read')} קובץ: ${f}`;
    }
    case 'Write': {
      const f = base(i.file_path);
      return VIDEO_EXT.test(f) ? `${v('save')} וידאו: ${f}` : `${v('write')} קובץ: ${f}`;
    }
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return `${v('update')} קובץ: ${base(i.file_path || i.notebook_path)}`;
    case 'Glob':
      return `${v('search')} קבצים`;
    case 'Grep':
      return i.pattern ? `${v('search')} בקבצים: ${i.pattern}` : `${v('search')} בקבצים`;
    case 'Bash':
    case 'PowerShell':
      return describeCommand(i.command, v);
    case 'WebSearch':
      return `${v('search')} ברשת: ${i.query ?? ''}`.trim();
    case 'WebFetch':
      return `${v('read')} דף באינטרנט${hostOf(i.url) ? ': ' + hostOf(i.url) : ''}`;
    case 'Skill':
      return `${v('activate')} סקיל: ${i.skill ?? i.name ?? ''}`.trim();
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate':
      return `${v('plan')} את העבודה`;
    case 'AskUserQuestion':
      return `${v('ask')} שאלה`;
    case 'Artifact':
      return `${v('update')} דף תצוגה`;
    case 'ExitPlanMode':
    case 'EnterPlanMode':
      return `${v('plan')} את העבודה`;
    case 'Monitor':
    case 'ScheduleWakeup':
      return `${v('wait')} לתוצאה`;
    default:
      if (typeof tool === 'string' && tool.startsWith('mcp__')) return describeMcp(tool, v);
      return `${v('work')} על המשימה`;
  }
}

export function translate(raw, genders = {}) {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const ev = toEvent(raw, genders);
    // Same id for the main chat and its agents (calibration) - which is exactly what lets the page
    // follow ONE conversation and ignore any other session open in the same project.
    if (ev) ev.sid = String(raw.session_id ?? '').slice(0, 8);
    return ev;
  } catch {
    return null;
  }
}

function toEvent(raw, genders) {
  {
    const known = (name) => typeof name === 'string' && Object.prototype.hasOwnProperty.call(genders, name);
    const keyOf = (name) => (known(name) ? name : 'helper');
    const genderOf = (key) => (key === 'lead' || key === 'helper' ? 'm' : genders[key] || 'm');
    // Who sent this event? Agent events carry agent_type; main-chat events do not (session_id is useless here).
    const actor = raw.agent_type ? keyOf(raw.agent_type) : 'lead';

    switch (raw.hook_event_name) {
      case 'UserPromptSubmit':
        return { type: 'request', text: clip(raw.prompt, 140) };

      case 'PreToolUse': {
        const input = raw.tool_input && typeof raw.tool_input === 'object' ? raw.tool_input : {};
        // Order matters (trap 11): first "is this an agent launch?", only then "who is acting?".
        if (AGENT_TOOLS.has(raw.tool_name)) {
          const rawAgent = typeof input.subagent_type === 'string' ? input.subagent_type : '';
          return {
            type: 'handoff',
            from: actor,
            to: keyOf(rawAgent),
            rawAgent,
            task: clip(input.description || input.prompt || '', 60),
          };
        }
        return { type: 'action', agent: actor, label: clip(describe(raw.tool_name, input, genderOf(actor)), MAX_LABEL), tool: String(raw.tool_name ?? '') };
      }

      case 'SubagentStop':
        return { type: 'done', agent: keyOf(raw.agent_type), rawAgent: String(raw.agent_type ?? '') };

      case 'Stop':
        return { type: 'turn_end' };

      default:
        return null;
    }
  }
}
