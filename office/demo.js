// Demo script: feeds FAKE hook payloads through the real pipeline (translate -> events.jsonl),
// so the office moves without running real agents. For tuning animations, and as a stage backup with no internet.
//
//   node office/demo.js              the full story (~70 seconds)
//   node office/demo.js --fast       same story, 3x faster
//   node office/demo.js --stress     parallel work: same agent twice at once, out-of-order lines, unknown agent
//   node office/demo.js --loop       repeat forever (Ctrl+C to stop)
import { translate } from './lib/translate.js';
import { loadGenders } from './lib/roster.js';
import { appendEvent, AGENTS_DIR, PROJECT_DIR } from './lib/eventlog.js';

const args = process.argv.slice(2);
const speed = args.includes('--fast') ? 3 : 1;
const genders = loadGenders(AGENTS_DIR);
const P = (rel) => PROJECT_DIR + '\\' + rel.replace(/\//g, '\\');
const ELAD = 'clients/Elad Grubner Photography';

let agentSeq = 0;
const agentIds = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms / speed));

function emit(raw) {
  const ev = translate({ session_id: 'demo', cwd: PROJECT_DIR, ...raw }, genders);
  if (ev) appendEvent(ev);
}
const as = (agent) => (agent ? { agent_type: agent, agent_id: agentIds[agent] || 'demo' } : {});
const prompt = (text) => emit({ hook_event_name: 'UserPromptSubmit', prompt: text });
const tool = (agent, tool_name, tool_input) => emit({ hook_event_name: 'PreToolUse', ...as(agent), tool_name, tool_input });
function launch(from, subagent_type, description) {
  agentIds[subagent_type] = 'demo' + (++agentSeq);
  emit({ hook_event_name: 'PreToolUse', ...as(from), tool_name: 'Agent', tool_input: { subagent_type, description, prompt: description } });
}
const stop = (agent) => emit({ hook_event_name: 'SubagentStop', ...as(agent) });
const end = () => emit({ hook_event_name: 'Stop' });
const read = (agent, rel) => tool(agent, 'Read', { file_path: P(rel) });

async function story() {
  prompt('תכיני לאלעד קרוסלה לאינסטגרם מהפרויקט של מריאנה דובניקובה, וגם תבדקי איך הלכו הפוסטים השבוע');
  await sleep(2500);
  read(null, 'CLAUDE.md'); await sleep(1800);
  tool(null, 'Skill', { skill: 'organic-post-from-photos' }); await sleep(2200);

  // the planner and the analyst work in parallel
  launch(null, 'content-planner', 'שיבוץ הקרוסלה בלוח התוכן');
  await sleep(400);
  launch(null, 'organic-analyst', 'ניתוח הפוסטים של השבוע');
  await sleep(2600);
  read('content-planner', `${ELAD}/content/calendar.md`); await sleep(1500);
  tool('organic-analyst', 'mcp__metricool__getAnalyticsDataByMetrics', {}); await sleep(1500);
  read('content-planner', `${ELAD}/content/history.md`); await sleep(2200);
  read('organic-analyst', `${ELAD}/content/analytics/insights.md`); await sleep(1600);
  tool('content-planner', 'Edit', { file_path: P(`${ELAD}/content/calendar.md`) }); await sleep(2000);
  stop('content-planner'); await sleep(2500);

  launch(null, 'photo-selector', 'בחירת 6 תמונות לקרוסלה');
  await sleep(2500);
  read('photo-selector', `${ELAD}/assets/projects/marianna-dubnikova/project.md`); await sleep(1600);
  tool('photo-selector', 'mcp__drive__search_files', { query: 'marianna' }); await sleep(1600);
  for (const f of ['living-room-01.jpg', 'kitchen-03.jpg', 'bedroom-02.jpg', 'detail-07.jpg']) {
    read('photo-selector', `${ELAD}/assets/projects/marianna-dubnikova/${f}`); await sleep(1300);
  }
  tool('organic-analyst', 'WebSearch', { query: 'interior photographers instagram carousel' }); await sleep(1500);
  tool('photo-selector', 'Write', { file_path: P(`${ELAD}/content/posts/marianna/selection.md`) }); await sleep(1800);
  stop('photo-selector'); await sleep(1200);
  tool('organic-analyst', 'Write', { file_path: P(`${ELAD}/content/analytics/report.md`) }); await sleep(1500);
  stop('organic-analyst'); await sleep(2500);

  launch(null, 'content-writer', 'קופי לקרוסלה של מריאנה');
  await sleep(2500);
  read('content-writer', `${ELAD}/style.md`); await sleep(1500);
  read('content-writer', `${ELAD}/content/posts/marianna/selection.md`); await sleep(1800);
  tool('content-writer', 'Write', { file_path: P(`${ELAD}/content/posts/marianna/post.md`) }); await sleep(2500);
  stop('content-writer'); await sleep(2500);

  read(null, `${ELAD}/content/posts/marianna/post.md`); await sleep(2000);
  end();
}

async function stress() {
  prompt('בדיקת עומס: שתי בחירות תמונות במקביל, עוזר כללי, ושורות שמגיעות בסדר הפוך');
  await sleep(1500);
  launch(null, 'photo-selector', 'בחירה לפוסט א');
  await sleep(300);
  launch(null, 'photo-selector', 'בחירה לפוסט ב'); // same agent, twice at once
  await sleep(300);
  launch(null, 'Explore', 'חיפוש בקבצים'); // not in the roster -> generic helper
  await sleep(2000);
  read('photo-selector', `${ELAD}/assets/a.jpg`); await sleep(800);
  tool('Explore', 'Grep', { pattern: 'אישור פרסום' }); await sleep(800);
  read('photo-selector', `${ELAD}/assets/b.jpg`); await sleep(1200);
  stop('photo-selector'); await sleep(1500); // first finishes - robot must keep working on the second
  read('photo-selector', `${ELAD}/assets/c.jpg`); await sleep(1500);
  stop('Explore'); await sleep(800);
  // out-of-order: an action arrives from an agent that was never launched
  read('content-writer', `${ELAD}/style.md`); await sleep(800);
  stop('content-writer'); await sleep(800);
  stop('photo-selector'); await sleep(400);
  stop('photo-selector'); // extra "done" for an idle agent: must be ignored
  await sleep(1500);
  // new task right after finishing: the rest timer must be cancelled
  launch(null, 'photo-selector', 'עוד בחירה מהירה'); await sleep(2000);
  read('photo-selector', `${ELAD}/assets/d.jpg`); await sleep(2000);
  stop('photo-selector'); await sleep(2000);
  end();
}

const run = args.includes('--stress') ? stress : story;
do {
  await run();
  if (args.includes('--loop')) await sleep(8000);
} while (args.includes('--loop'));
