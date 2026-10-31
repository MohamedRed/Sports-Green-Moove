import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parse} from 'yaml';

const text = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('context enrichment reads only selected trip IDs after authenticated review pagination', () => {
  const source = text('functions/src/services/pendingReviews.ts');
  assert(source.indexOf('selectPendingReviews(rides') < source.indexOf('pendingReviewTripIds(selected.items'));
  assert.match(source, /firestore.getAll\(\.\.\.tripIds.map/);
  assert.match(source, /attachReviewTripContexts\(selected.items, rides/);
  assert(!/\.set\(|\.update\(|\.create\(/.test(source));
  const context = text('functions/src/domain/reviewTripContext.ts');
  for (const required of ['Europe/Brussels', 'trip.driverUserId === ride.driverUserId',
    'trip.activeRideSessionId === item.rideSessionId', 'trip?.status === "completed"', 'tripContext: ReviewTripContext | null = null'])
    assert(context.includes(required));
  assert(!/Date.now|startedAt|origin|destination|fetch\(/.test(context));
});
test('both native parsers require explicit available/unavailable details and both cards render the context', () => {
  const android = 'android/app/src/main/java/be/sportgreenmoove/app/';
  assert.match(text(android + 'services/FirebaseAndroidPendingReviewGateway.kt'), /parseReviewTripContext\(row\)/);
  assert.match(text(android + 'services/ReviewTripContextParser.kt'), /containsKey\("tripContext"\)/);
  const card = text(android + 'ui/ReviewCard.kt');
  for (const required of ['trip.title', 'trip.departureLabel', 'Détails du trajet indisponibles']) assert(card.includes(required));
  assert(!card.includes('TextOverflow.Ellipsis')); assert(!card.includes('maxLines'));
  assert(!text(android + 'ui/MessagesCards.kt').includes('fun ReviewCard'));
  const ios = 'ios/Sources/SportsGreenMooveApp/';
  assert.match(text(ios + 'PendingReviewWire.swift'), /ReviewTripContextWire.parse\(row\)/);
  assert.match(text(ios + 'MessagesScreen.swift'), /trip.departureLabel/);
  assert.match(text('scripts/check-ios-native-plan.sh'), /ReviewTripContextWire.swift/);
});
test('smoke runs authenticated context and phone-checkpoint checks on pull requests and pushes', () => {
  const source = text('.github/workflows/web-integration-smoke.yml'), workflow = parse(source);
  for (const file of ['review-context-contract.test.mjs', 'review-context-evidence.test.mjs',
    'review-context-phone-checkpoints.test.mjs', 'review-context-phone-evidence.test.mjs', 'review-context-replay-evidence.test.mjs'])
    assert.equal(source.split('"tests/' + file + '"').length - 1, 2);
  const step = workflow.jobs.smoke.steps.find(row => row.name === 'Test authenticated pending review trip context');
  assert.match(step.run, /npm run test:review-context/);
  assert.match(step.run, /tests\/review-context-phone-checkpoints.test.mjs/);
  assert.equal(source.split('"scripts/qa/*review-context-phone*.mjs"').length - 1, 2);
  assert.equal(source.split('"scripts/qa/*review-context-replay*.mjs"').length - 1, 2);
  assert.match(step.run, /tests\/review-context-replay-evidence.test.mjs/);
  assert.equal(step.env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/review-context.json');
  const upload = workflow.jobs.smoke.steps.find(row => row.with?.name === 'review-context-results');
  assert.equal(upload.if, 'always()'); assert.equal(upload.with.path, '${{ runner.temp }}/review-context.json');
});
