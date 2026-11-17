import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateRetainedTeamChatUi, validateTeamChatComponents } from '../scripts/qa/team-chat-ui-evidence.mjs';
const source = 'docs/release/evidence/team-chat-components-2026-10-21/results.json';
test('retained UI proof binds three executed cases, originals, ten units and separate service trials', () => {
  const run = validateRetainedTeamChatUi(process.cwd(), source);
  assert.equal(run.componentCaseCount, 3); assert.equal(run.connectedBackend, false);
});
for (const key of ['connectedBackend', 'notificationsVerified', 'physicalDevice', 'productionWrites']) {
  test('component evidence cannot promote ' + key, () => {
    const run = JSON.parse(readFileSync(new URL('../' + source, import.meta.url)));
    run[key] = true; assert.throws(() => validateTeamChatComponents(run));
  });
}
test('missing device restoration or an incomplete case cannot become accepted evidence', () => {
  const run = JSON.parse(readFileSync(new URL('../' + source, import.meta.url)));
  assert.throws(() => validateTeamChatComponents({ ...run, devicePolicyRestored: false }));
  assert.throws(() => validateTeamChatComponents({ ...run, steps: run.steps.slice(1) }));
  assert.throws(() => validateTeamChatComponents({ ...run, screenshots: {} }));
});
