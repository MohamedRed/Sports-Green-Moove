import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { validateHistoryPhoneArtifacts } from './team-history-phone-evidence.mjs';
import { validateTeamConnectionRecovery } from '../scripts/qa/team-connection-recovery-evidence.mjs';

export function validateTeamEnrollmentRecords(root, flow) {
  if (flow.connectionRecoveryPhone) {
    assert.equal(flow.id, 'team-enrollment'); assert.equal(flow.status, 'partial');
    const evidence = flow.connectionRecoveryPhone;
    assert.equal(evidence.checksums, dirname(evidence.source) + '/artifact-sha256.json');
    assert.equal(validateTeamConnectionRecovery(root, evidence.source).testedAt.slice(0, 10), evidence.checkedAt);
    assert.equal(flow.checkedAt, evidence.checkedAt);
  }
  if (flow.historyPhone) {
    assert.equal(flow.status, 'partial');
    const date = flow.historyPhone.checkedAt ?? flow.checkedAt;
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/); assert(date <= flow.checkedAt);
    assert.equal(validateHistoryPhoneArtifacts(root, flow.historyPhone.source).testedAt.slice(0, 10), date);
  }
}
