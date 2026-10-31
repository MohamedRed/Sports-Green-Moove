import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { assertTeamConnectionRecovery, validateTeamConnectionRecovery, teamConnectionRecoveryDirectory } from '../scripts/qa/team-connection-recovery-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
const json = name => JSON.parse(readFileSync(resolve(root, teamConnectionRecoveryDirectory, name + '.json')));
const reports = () => [json('summary'), json('session-results'), json('ui-review'), json('runtime-cleanup'), json('helper-lifecycle'),
  ['self-requested', 'self-refused'].map(json),
  ['self-requested', 'self-refused'].map(phase => [json(phase + '-before-stop'), json(phase + '-after-stop')])];

test('retained phone observation accepts connection recovery only, not the unfinished restart journey', () => {
  assert.equal(validateTeamConnectionRecovery(root).fullProcessRestartProven, false);
});
test('a pending kill, installed-byte assumption or broader release claim cannot become a pass', () => {
  for (const [index, flag] of [[0, 'fullProcessRestartProven'], [0, 'releaseEvidenceAccepted'], [0, 'installedBytesIndependentlyVerified'],
    [0, 'completeEnrollmentJourneyAccepted'], [1, 'completed'], [2, 'providerKillCompletionObserved'], [2, 'phoneSignoutObserved']]) {
    const args = reports(); args[index][flag] = true;
    assert.throws(() => assertTeamConnectionRecovery(...args));
  }
});
test('the same request and ordered events must survive, not a replacement or duplicate', () => {
  for (const mutate of [args => args[5][1].state.events.pop(),
    args => args[6][0][1].documents[0].updateTime = 'changed',
    args => args[6][0][1].documents.push(args[6][0][1].documents[0]),
    args => args[6][1][1].documents[0].fields.status.stringValue = 'approved']) {
    const args = reports(); mutate(args); assert.throws(() => assertTeamConnectionRecovery(...args));
  }
});
test('unsolicited helper success, automatic reconnect and incomplete disposal are rejected', () => {
  for (const mutate of [args => args[4].first.acceptedAsExpectedShutdown = true,
    args => args[4].first.causeConfirmed = true, args => args[4].automaticReconnectAdded = true,
    args => args[3].processGroupExited = false, args => args[3].ports[0].available = false]) {
    const args = reports(); mutate(args); assert.throws(() => assertTeamConnectionRecovery(...args));
  }
});
