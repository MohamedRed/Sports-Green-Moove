import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parse} from 'yaml';

const text = path => readFileSync(path, 'utf8');
test('received summaries aggregate the authenticated recipient without limiting history or exposing details', () => {
  const source = text('functions/src/callables/receivedRatings.ts');
  assert.match(source, /requireAuth\(request.auth\?\.uid\)/);
  assert.match(source, /where\("ratedUserId", "==", uid\)/);
  assert.match(source, /AggregateField\.count\(\)/); assert.match(source, /AggregateField\.average\("score"\)/);
  assert(!/\.limit\(|driverRating|comment:|authorUserId:/.test(source));
  const indexes = JSON.parse(text('firestore.indexes.json')).indexes;
  assert(indexes.some(row => row.collectionGroup === 'ratings' && row.queryScope === 'COLLECTION' &&
    JSON.stringify(row.fields) === JSON.stringify([{fieldPath: 'ratedUserId', order: 'ASCENDING'}, {fieldPath: 'score', order: 'ASCENDING'}])));
  const rule = text('firestore.rules').split('match /ratings/{ratingId}')[1].split('match /co2Ledger')[0];
  assert.match(rule, /allow read: if signedIn\(\) && resource.data.authorUserId == request.auth.uid/);
  assert.match(rule, /allow create, update, delete: if false/);
});
test('the native profile uses its own session-checked gateway and closes stale profile reads', () => {
  const base = 'android/app/src/main/java/be/sportgreenmoove/app/';
  const gateway = text(base + 'services/FirebaseAndroidReceivedRatingsGateway.kt');
  assert.equal(gateway.match(/requireSession\(uid\)/g).length, 2);
  assert.match(gateway, /getReceivedRatingSummary/); assert.match(gateway, /parseReceivedRatingSummary\(response.data, uid\)/);
  const host = text(base + 'ui/ProfileReceivedRatings.kt'); assert.match(host, /key\(uid, gateway\)/);
  assert.match(host, /onDispose \{ state.close\(\) \}/); assert.match(host, /Lifecycle.State.RESUMED/);
  assert.match(text(base + 'ui/ProfileRoute.kt'), /ProfileReceivedRatings\(uid, ratingsGateway\)/);
  assert.match(text(base + 'ui/SportsGreenMooveApp.kt'), /ratingsGateway = providers.receivedRatings/);
});
test('both smoke triggers include the aggregate contract and the authenticated service runner', () => {
  const source = text('.github/workflows/web-integration-smoke.yml'), workflow = parse(source);
  assert.equal(source.split('"tests/received-ratings-contract.test.mjs"').length - 1, 2);
  const steps = workflow.jobs.smoke.steps.filter(row => row.name === 'Test private received rating summaries');
  assert.equal(steps.length, 1); assert.match(steps[0].run, /npm run test:received-ratings/);
  assert.equal(steps[0].env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/received-ratings.json');
});
