import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { validateTeamChatNativeAttempt } from '../scripts/qa/team-chat-native-attempt.mjs';
import { validateRetainedTeamChatConnected } from '../scripts/qa/team-chat-connected-retained.mjs';
import { validateRetainedTeamChatAccess } from '../scripts/qa/team-chat-access-evidence.mjs';
import { validateRetainedTeamAccessAttempt } from '../scripts/qa/team-access-native-attempt.mjs';
import { validateRetainedTeamAccessNative } from '../scripts/qa/team-access-native-retained.mjs';
import { validateTeamDraftNativeAttempt } from '../scripts/qa/team-draft-native-attempt.mjs';
import { validateTeamDraftLoss } from '../scripts/qa/team-draft-loss-evidence.mjs';
import { validateRetainedTeamDraft } from '../scripts/qa/team-draft-native-retained.mjs';
import { validateTeamDraftErrorCaptureAttempt } from '../scripts/qa/team-draft-error-capture-attempt.mjs';
import { validateTeamDraftErrorComponents } from '../scripts/qa/team-draft-error-components.mjs';
import { validateTeamDraftPhone } from '../scripts/qa/team-draft-phone-evidence.mjs';
import { validateRetainedTeamReads } from '../scripts/qa/team-read-retained-evidence.mjs';
import { validateRetainedConnectedTeamReads } from '../scripts/qa/team-read-connected-evidence.mjs';
import { validateTeamReadComponentAttempt } from '../scripts/qa/team-read-component-attempt.mjs';
import { validateRetainedTeamReadComponents } from '../scripts/qa/team-read-component-evidence.mjs';

export function validateTeamConversationRecords(root, flow, captures) {
  if (flow.readComponents) assert.equal(flow.latestEvidence, 'local');
  const records = [
    [flow.attempt, validateTeamChatNativeAttempt, 'team-chat-native-'],
    [flow.connected, validateRetainedTeamChatConnected, 'team-chat-connected-'],
    [flow.accessChanges, validateRetainedTeamChatAccess, null],
    [flow.readServices, validateRetainedTeamReads, null],
    [flow.readConnected, validateRetainedConnectedTeamReads, null],
    [flow.readAttempt, validateTeamReadComponentAttempt, null],
    [flow.readComponents, validateRetainedTeamReadComponents, 'team-read-verified-'],
    [flow.accessAttempt, validateRetainedTeamAccessAttempt, 'team-access-attempt-'],
    [flow.nativeAccess, validateRetainedTeamAccessNative, 'team-access-verified-'],
    [flow.draftAttempt, validateTeamDraftNativeAttempt, null],
    [flow.draftRegression, validateTeamDraftLoss, 'team-draft-loss-'],
    [flow.draftRestart, validateRetainedTeamDraft, 'team-draft-verified-'],
    [flow.draftErrorChecks, validateTeamDraftErrorCaptureAttempt, null],
    [flow.draftErrorRecovery, validateTeamDraftErrorComponents, 'team-draft-errors-'],
    [flow.id === 'team-conversation' ? flow.phone : null, validateTeamDraftPhone, 'team-draft-phone-'],
  ];
  for (const [record, validate, prefix] of records) {
    if (!record) continue;
    assert.equal(flow.id, 'team-conversation'); assert.equal(flow.status, 'partial');
    const run = validate(root, record.source); assert.equal(run.testedAt.slice(0, 10), flow.checkedAt);
    if (prefix) {
      assert.deepEqual(flow.images.filter(image => image.file.startsWith(prefix)).map(image => image.file).sort(),
        Object.keys(run.publishedCaptures).sort());
      for (const [id, file] of Object.entries(run.publishedCaptures)) assert.equal(captures[id], dirname(record.source) + '/' + file);
    }
  }
}
