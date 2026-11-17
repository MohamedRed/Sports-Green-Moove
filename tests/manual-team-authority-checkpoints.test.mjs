import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { teamAuthorityPhases, teamAuthorityIncoming, teamAuthorityReply,
  verifyTeamAuthorityCheckpoint } from '../scripts/qa/manual-team-authority-checkpoints.mjs';

const identity = {earlyMessageId: 'early', initialMessageId: 'initial', newMessageId: 'new', parentUid: 'parent', driverUid: 'driver'};
function stateFor(phase) {
  const index = teamAuthorityPhases.indexOf(phase);
  const entries = [{id: 'early', body: 'Before admission', senderUserId: 'driver'},
    {id: 'initial', body: 'After first admission', senderUserId: 'driver'},
    {id: 'new', body: teamAuthorityIncoming, senderUserId: 'driver'},
    {id: 'reply', body: teamAuthorityReply, senderUserId: 'parent'}]
    .slice(0, index < 3 ? 2 : index === 3 ? 3 : 4)
    .map((row, i) => ({...row, sequence: i + 1, clientMessageId: 'request-' + i}));
  return {guardian: {status: phase === 'revoked' ? 'revoked' : 'verified', revision: index === 0 ? 2 : index === 1 ? 3 : 5},
    parentDenied: phase === 'revoked', parentMessageIds: index === 0 ? ['initial'] : index < 3 ? [] :
      ['new', ...(phase === 'replied' ? ['reply'] : [])], otherParentMessageIds: entries.slice(1).map(row => row.id),
    entries, parentMessageId: phase === 'replied' ? 'reply' : null,
    operationIds: entries.map(row => row.id), lastSequence: entries.length};
}
for (const phase of teamAuthorityPhases) test(`record validator accepts the explicit ${phase} boundary without a UI claim`, () => {
  const result = verifyTeamAuthorityCheckpoint(phase, stateFor(phase), identity);
  assert.equal(result.phase, phase); assert.equal(result.historicalMessagesRestored, false);
  assert(!Object.hasOwn(result, 'phoneUiProven'));
});
for (const [phase, mutate] of [
  ['initial', value => value.parentMessageIds.push('early')],
  ['revoked', value => value.parentDenied = false],
  ['revoked', value => value.guardian.status = 'verified'],
  ['renewed', value => value.guardian.revision = 2],
  ['renewed', value => value.parentMessageIds.push('initial')],
  ['new-message', value => value.otherParentMessageIds.pop()],
  ['new-message', value => value.entries[2].senderUserId = 'parent'],
  ['new-message', value => value.entries[2].body = 'Different content'],
  ['replied', value => value.entries[3].body = 'Different reply'],
  ['replied', value => value.entries[3].clientMessageId = value.entries[2].clientMessageId],
  ['replied', value => value.entries[3].sequence = 3],
  ['replied', value => value.operationIds.push('extra-operation')],
  ['replied', value => value.lastSequence = 5],
  ['replied', value => value.parentMessageId = 'foreign'],
]) test(`record validator rejects a contradictory ${phase} checkpoint: ${mutate}`, () => {
  const state = stateFor(phase); mutate(state);
  assert.throws(() => verifyTeamAuthorityCheckpoint(phase, state, identity));
});
test('interactive controller separates authenticated fixture decisions from observed phone results', () => {
  const source = readFileSync('scripts/qa/manual-team-authority-phone-session.mjs', 'utf8');
  for (const required of ['process.stdin.isTTY', 'Never repeat an unknown write', 'verifyTeamChatProtectedBaseline(f)',
    'phoneUiProven: false', 'managerUiProven: false', 'twoPhoneFlowVerified: false', 'notificationsVerified: false',
    'releaseEvidenceAccepted: false', 'await deleteApp(getApp())', "phase === 'finish'", "phase === 'stop'"])
    assert(source.includes(required), required);
  assert(!source.includes("call('markTeamChatMessagesRead'"));
  const workflow = readFileSync('.github/workflows/web-integration-smoke.yml', 'utf8');
  assert.equal(workflow.split('"tests/manual-team-authority-checkpoints.test.mjs"').length - 1, 2);
  assert.match(workflow, /run: node --test[^\n]*tests\/manual-team-authority-checkpoints.test.mjs/);
});
