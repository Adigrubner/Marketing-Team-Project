import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../lib/translate.js';

// Roster as the hook sees it: agent name -> grammatical gender ('m' / 'f').
const ROSTER = { 'content-planner': 'f', 'photo-selector': 'f', 'manager': 'm', 'ads-analyst': 'm' };

const base = { session_id: 's1', cwd: 'C:\\proj', transcript_path: 'x' };
const fromAgent = (type, id = 'a1') => ({ agent_id: id, agent_type: type });

test('UserPromptSubmit -> request with the prompt text', () => {
  const e = translate({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'תכיני לי פוסט' }, ROSTER);
  assert.equal(e.type, 'request');
  assert.equal(e.text, 'תכיני לי פוסט');
});

test('long request text is trimmed for display', () => {
  const e = translate({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'א'.repeat(500) }, ROSTER);
  assert.ok(e.text.length <= 140);
});

test('Agent tool from the main chat -> handoff from lead', () => {
  const e = translate({
    ...base, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 't1',
    tool_input: { subagent_type: 'content-planner', description: 'ספירת פוסטים', prompt: 'long...' },
  }, ROSTER);
  assert.deepEqual(
    { type: e.type, from: e.from, to: e.to, task: e.task },
    { type: 'handoff', from: 'lead', to: 'content-planner', task: 'ספירת פוסטים' },
  );
});

test('legacy Task tool name is also a handoff', () => {
  const e = translate({
    ...base, hook_event_name: 'PreToolUse', tool_name: 'Task',
    tool_input: { subagent_type: 'manager', description: 'x' },
  }, ROSTER);
  assert.equal(e.type, 'handoff');
  assert.equal(e.to, 'manager');
});

// Trap 11: the agent-launching check must come BEFORE the "event carries agent identity" check.
test('Agent tool fired from inside an agent -> handoff from that agent (not an action)', () => {
  const e = translate({
    ...base, ...fromAgent('manager'), hook_event_name: 'PreToolUse', tool_name: 'Agent',
    tool_input: { subagent_type: 'photo-selector', description: 'בחירת תמונות' },
  }, ROSTER);
  assert.equal(e.type, 'handoff');
  assert.equal(e.from, 'manager');
  assert.equal(e.to, 'photo-selector');
});

test('handoff to an agent outside the roster maps to the generic helper', () => {
  const e = translate({
    ...base, hook_event_name: 'PreToolUse', tool_name: 'Agent',
    tool_input: { subagent_type: 'Explore', description: 'חיפוש' },
  }, ROSTER);
  assert.equal(e.to, 'helper');
  assert.equal(e.rawAgent, 'Explore');
});

test('handoff with no subagent_type goes to the generic helper', () => {
  const e = translate({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { description: 'x' } }, ROSTER);
  assert.equal(e.to, 'helper');
});

test('tool use inside an agent -> action by that agent, in human words and in its gender', () => {
  const e = translate({
    ...base, ...fromAgent('content-planner'), hook_event_name: 'PreToolUse', tool_name: 'Read',
    tool_input: { file_path: 'C:\\proj\\clients\\X\\brief.md' },
  }, ROSTER);
  assert.equal(e.type, 'action');
  assert.equal(e.agent, 'content-planner');
  assert.equal(e.label, 'קוראת קובץ: brief.md');
});

test('tool use in the main chat -> action by lead (masculine)', () => {
  const e = translate({
    ...base, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: '/a/b/style.md' },
  }, ROSTER);
  assert.equal(e.agent, 'lead');
  assert.equal(e.label, 'קורא קובץ: style.md');
});

test('tool use by an unknown agent -> action by helper', () => {
  const e = translate({
    ...base, ...fromAgent('general-purpose'), hook_event_name: 'PreToolUse', tool_name: 'Glob', tool_input: { pattern: '*' },
  }, ROSTER);
  assert.equal(e.agent, 'helper');
  assert.equal(e.label, 'מחפש קבצים');
});

test('reading an image reads as looking at a photo', () => {
  const e = translate({
    ...base, ...fromAgent('photo-selector'), hook_event_name: 'PreToolUse', tool_name: 'Read',
    tool_input: { file_path: 'D:/photos/living-room-03.JPG' },
  }, ROSTER);
  assert.equal(e.label, 'מסתכלת על תמונה: living-room-03.JPG');
});

test('meta report command reads as a performance report', () => {
  const e = translate({
    ...base, ...fromAgent('ads-analyst'), hook_event_name: 'PreToolUse', tool_name: 'Bash',
    tool_input: { command: 'node tools/meta-report.js --days 7' },
  }, ROSTER);
  assert.equal(e.label, 'מריץ דוח ביצועים');
});

test('labels for write / edit / search / web / skill / mcp', () => {
  const a = (tool_name, tool_input) =>
    translate({ ...base, ...fromAgent('photo-selector'), hook_event_name: 'PreToolUse', tool_name, tool_input }, ROSTER).label;
  assert.equal(a('Write', { file_path: 'x/selection.md' }), 'כותבת קובץ: selection.md');
  assert.equal(a('Edit', { file_path: 'x/history.md' }), 'מעדכנת קובץ: history.md');
  assert.equal(a('Grep', { pattern: 'סלון' }), 'מחפשת בקבצים: סלון');
  assert.equal(a('WebSearch', { query: 'interior photographers' }), 'מחפשת ברשת: interior photographers');
  assert.equal(a('Skill', { skill: 'build-reel' }), 'מפעילה סקיל: build-reel');
  assert.equal(a('mcp__abc__search_files', {}), 'מחפשת בגוגל דרייב');
  assert.equal(a('mcp__abc__createScheduledPost', {}), 'מתזמנת פוסט במטריקול');
  assert.equal(a('SomethingNew', {}), 'עובדת על המשימה');
});

test('labels are kept short', () => {
  const e = translate({
    ...base, ...fromAgent('photo-selector'), hook_event_name: 'PreToolUse', tool_name: 'Read',
    tool_input: { file_path: '/x/' + 'very-long-file-name-'.repeat(10) + '.md' },
  }, ROSTER);
  assert.ok(e.label.length <= 48, e.label);
});

test('SubagentStop -> done for that agent', () => {
  const e = translate({ ...base, ...fromAgent('content-planner'), hook_event_name: 'SubagentStop' }, ROSTER);
  assert.equal(e.type, 'done');
  assert.equal(e.agent, 'content-planner');
});

test('SubagentStop of an unknown agent -> done for helper', () => {
  const e = translate({ ...base, ...fromAgent('Explore'), hook_event_name: 'SubagentStop' }, ROSTER);
  assert.equal(e.agent, 'helper');
});

test('Stop -> turn_end', () => {
  assert.equal(translate({ ...base, hook_event_name: 'Stop' }, ROSTER).type, 'turn_end');
});

test('events we do not show return null', () => {
  for (const ev of ['SessionStart', 'SessionEnd', 'PostToolUse', 'Notification', 'SubagentStart', 'PreCompact']) {
    assert.equal(translate({ ...base, hook_event_name: ev }, ROSTER), null, ev);
  }
});

test('garbage input never throws', () => {
  for (const bad of [null, undefined, 42, 'x', {}, { hook_event_name: 'PreToolUse' }, { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: null }]) {
    assert.doesNotThrow(() => translate(bad, ROSTER));
  }
});
