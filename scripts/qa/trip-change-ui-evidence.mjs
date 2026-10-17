import assert from 'node:assert/strict';

export function assertTripChangeUiReceipt(receipt, { fixtures, runId }) {
  assert.equal(receipt.projectId, 'demo-sgm-local-qa'); assert.equal(receipt.runId, runId);
  assert.equal(receipt.scope, 'native-three-account-trip-consent-ui'); assert.equal(receipt.completed, true);
  for (const key of ['firstParentPending', 'secondParentConfirmed', 'refusalVisible', 'withdrawalVisible', 'routeRequiredBeforeApplication']) {
    assert.equal(receipt[key], true, key);
  }
  assert.equal(receipt.confirmedTripId, fixtures.confirmed.tripId);
  assert.equal(receipt.declinedTripId, fixtures.declined.tripId);
  assert.equal(receipt.withdrawnTripId, fixtures.withdrawn.tripId);
}
