import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parse} from 'yaml';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('rating replay checks current ride authority and exact immutable content in the same transaction', () => {
  const service = source('functions/src/services/ratingSubmission.ts');
  assert.match(service, /firestore.runTransaction/); assert.match(service, /transaction.getAll\(rideRef, ratingRef\)/);
  assert(service.indexOf('participants.includes(uid)') < service.indexOf('if (ratingSnap.exists)'));
  assert(service.indexOf('ride.status !== "completed"') < service.indexOf('if (ratingSnap.exists)'));
  assert.match(service, /matchesRatingSubmission\(ratingSnap.data\(\)!, uid, data\)/);
  assert.match(service, /transaction.create\(ratingRef/); assert(!/transaction.update|ratingRef.create/.test(service));
  const callable = source('functions/src/callables/feedback.ts');
  assert.match(callable, /return submitRideRating\(uid, data\)/);
  assert(!callable.includes('type RideSessionDocument'));
});
test('submission failures stay attached to their review without replacing the loaded inbox', () => {
  const state = source('android/app/src/main/java/be/sportgreenmoove/app/ui/MessagesInboxState.kt');
  const submit = state.slice(state.indexOf('suspend fun submitReview'), state.indexOf('private suspend fun refreshMetadata'));
  assert.match(submit, /ReviewSubmissionFailure\(id,/); assert(!/error =|refreshMetadata|replace\(/.test(submit));
  assert.match(submit, /if \(closed \|\| submittingReviewId != null\) return/);
  assert.match(submit, /ensureActive\(\)/); assert.match(submit, /if \(closed\) return/);
  const route = source('android/app/src/main/java/be/sportgreenmoove/app/ui/MessagesInboxRoute.kt');
  assert.match(route, /state.submittingReviewId == review.id/);
  assert.match(route, /enabled = state.submittingReviewId == null/);
  assert.match(route, /state.reviewFailure\?\.takeIf \{ it.reviewId == review.id \}/);
  const native = source('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ReviewSubmissionRecoveryFlowTest.kt');
  assert.match(native, /loadedInboxCount, inboxLoads/); assert.match(native, /layout.hasVisualOverflow/);
});
test('local verification covers real loopback disconnects before and after commit without claiming physical proof', () => {
  const suite = source('scripts/qa/local-review-recovery.mjs');
  for (const token of ['drop-before', 'drop-after', 'request.socket.destroy()', 'Promise.all([call',
    'storedBeforeRetry', 'all-unrelated-records-claims-and-trip-details-remain-unchanged', 'physicalNetworkLossProven: false',
    'providerRequests: 0', 'productionWrites: false', 'phoneUiExecuted: false']) assert(suite.includes(token));
  assert.match(source('scripts/qa/run-local-review-recovery.mjs'), /result.checks.length, 8/);
});
test('pull requests run the rating retry service suite and retain results even on failure', () => {
  const yaml = source('.github/workflows/web-integration-smoke.yml'), workflow = parse(yaml);
  assert.equal(yaml.split('"tests/review-recovery-contract.test.mjs"').length - 1, 2);
  const step = workflow.jobs.smoke.steps.find(row => row.name === 'Test immutable rating retries after connection loss');
  assert.match(step.run, /npm run test:review-recovery/); assert.match(step.run, /review-recovery-contract.test.mjs/);
  const upload = workflow.jobs.smoke.steps.find(row => row.with?.name === 'review-recovery-results');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with.path, '${{ runner.temp }}/review-recovery.json*');
});
