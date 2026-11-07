import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateRetainedTeamAccessAttempt, validateTeamAccessAttemptRecord } from '../scripts/qa/team-access-native-attempt.mjs';
import { content, captures } from '../partner-portal/content.mjs';
const source = 'docs/release/evidence/team-access-native-send-2026-10-21/results.json';
test('partial access captures never accept the failed case, parent reply or independent state verification', () => {
  const run = validateRetainedTeamAccessAttempt(process.cwd(), source);
  const flow = content.flows.find(item => item.id === 'team-conversation');
  assert.equal(flow.accessAttempt.source, source); assert.equal(flow.status, 'partial');
  for (const [id, file] of Object.entries(run.publishedCaptures)) {
    assert(flow.images.some(image => image.file === id)); assert(captures[id].endsWith('/' + file));
  }
  assert(flow.nativeAccess.source.includes('team-access-native-2026-10-21'));
  assert.equal(run.otherTeamParentReplyVerified, false);
});
for (const key of ['nativeCaseCompleted', 'allElevenCheckpointsAccepted', 'independentStoredStateVerified',
  'otherTeamParentReplyVerified', 'returnToOriginalTeamVerified', 'sendFailureCauseVerified', 'physicalDevice', 'notificationsVerified']) {
  test(`partial access trial cannot promote ${key}`, () => {
    const run = JSON.parse(readFileSync(source)); run[key] = true; assert.throws(() => validateTeamAccessAttemptRecord(run));
  });
}
