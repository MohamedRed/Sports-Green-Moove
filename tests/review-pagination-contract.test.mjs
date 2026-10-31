import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parse} from 'yaml';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('review discovery has a bounded account-scoped cursor and no fixed ride history window', () => {
  const source = read('functions/src/services/pendingReviews.ts'), inbox = read('functions/src/callables/inbox.ts');
  for (const expected of ['pending-reviews:${uid}', 'parseMembershipPageCursor(cursor, scope)', 'Filter.or(',
    'FieldPath.documentId()', 'query.startAfter(', 'limit(REVIEW_SCAN_SIZE + 1)', 'firestore.getAll(']) assert(source.includes(expected));
  assert.doesNotMatch(inbox, /limit\(30\)|participantRides|driverRides/);
  assert(inbox.includes('reviewsNextCursor: reviews.nextCursor'));
  const indexes = JSON.parse(read('firestore.indexes.json')).indexes;
  for (const field of ['driverUserId', 'participantUserIds']) assert(indexes.some(index => index.collectionGroup === 'rideSessions' &&
    index.fields.length === 2 && index.fields.some(row => row.fieldPath === 'status') && index.fields.some(row => row.fieldPath === field)));
});
test('both native clients expose continuation, parse account-bound pages and remove submitted reviews without resetting pagination', () => {
  const android = read('android/app/src/main/java/be/sportgreenmoove/app/ui/MessagesInboxRoute.kt');
  const ios = read('ios/Sources/SportsGreenMooveApp/PendingReviewsContent.swift');
  for (const source of [android, ios]) for (const expected of ['Continuer la recherche', 'Voir d’autres avis', 'messages.reviews.more'])
    assert(source.includes(expected));
  for (const source of [read('android/app/src/main/java/be/sportgreenmoove/app/ui/MessagesInboxState.kt'),
    read('ios/Sources/SportsGreenMooveApp/MessagesScreen.swift')]) assert(source.includes('reviews.submitted('));
  assert(read('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidPendingReviewGateway.kt').includes('auth.currentUser?.uid != uid'));
  assert(read('ios/Sources/SportsGreenMooveApp/FirebaseInboxGateway.swift').includes('Auth.auth().currentUser?.uid == uid'));
});
test('the authenticated service suite and retained result run without weakening existing smoke coverage', () => {
  const workflow = parse(read('.github/workflows/web-integration-smoke.yml'));
  const steps = workflow.jobs.smoke.steps;
  const step = steps.find(row => row.name === 'Test pending review pagination across completed ride history');
  assert(step); assert.equal(step.env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/review-pagination.json');
  assert.equal(step.run, 'npm run test:review-pagination && node --test tests/review-pagination-contract.test.mjs tests/review-pagination-evidence.test.mjs');
  const upload = steps.find(row => row.with?.name === 'review-pagination-results');
  assert(upload); assert.equal(upload.if, 'always()'); assert(steps.indexOf(upload) > steps.findLastIndex(row => row.run));
  assert.equal(upload['continue-on-error'], undefined);
});
