import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { content } from '../partner-portal/content.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalParentSearchBookingTest.kt');
test('the prepared real-app trial cannot run in routine offline CI or on a physical/production package', () => {
  for (const required of ['args.containsKey("searchBookingApproved")', 'be.sportgreenmoove.app.local',
    'getprop ro.kernel.qemu', 'demo-sgm-local-qa', 'session.getBoolean("disposableEmulator")',
    'args.getString("searchBookingApproved") == session.getString("runId")', 'Instant.parse(departure).isAfter(Instant.now())',
    'assertEquals(0, checkNotNull(initialTrip.bookingIntent).priceCents)', 'assertEquals("sgm-qa-driver", initialTrip.driverUserId)'])
    assert(native.includes(required), required);
  assert(native.indexOf('assumeTrue(') < native.indexOf('AndroidRuntime.create(context)'));
  assert(!native.includes('compose.setContent')); assert(!native.includes('UiFlowFirebaseGateway'));
  for (const directWrite of ['.requestBooking(', '.approveBooking(', '.cancelBooking(', '.decide('])
    assert(!native.includes(directWrite), directWrite);
});
test('the chain uses actual UI actions, resolved addresses and the same two-seat child booking between accounts', () => {
  for (const required of ['ActivityScenario.launch(MainActivity::class.java)', 'AuthTestInteractions(compose, activity)',
    'onNodeWithContentDescription("Rechercher un trajet")', 'waitFor("$tag.resolved")',
    'onNodeWithText("2 places")', 'onNodeWithText("Consentement")',
    'SgmTestTags.SearchAction', 'SgmTestTags.BookingRequestConfirmed', 'login("driver")',
    'decide(id, ReservationDecision.Approve', 'login("parent"); reservations()',
    'decide(id, ReservationDecision.Cancel', 'assertEquals(2, booking.seats)', 'sgm-qa-child-lina',
    'listOf(4, 4, 2, 2, 4)', 'FirebaseFirestore.getInstance().terminate().await()']) assert(native.includes(required), required);
  assert(read('android/app/src/main/java/be/sportgreenmoove/app/ui/SearchPlaceFields.kt').includes('sgmTestTag("$testTag.resolved")'));
});
test('trip icon controls have explicit French names and roles with a native action regression', () => {
  const screen = read('android/app/src/main/java/be/sportgreenmoove/app/ui/TripsScreen.kt');
  for (const label of ['Rechercher un trajet', 'Mois précédent', 'Mois suivant']) assert(screen.includes(`label = "${label}"`));
  assert(screen.includes('contentDescription = label')); assert(screen.includes('clickable(role = Role.Button'));
  const regression = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SearchPublicationActionFlowTest.kt');
  assert(regression.includes('tripSearchAndMonthButtonsExposeNamedButtonActions'));
  assert(regression.includes('SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button)'));
});
test('preparation neither widens the existing paid-request guard nor promotes partner evidence', () => {
  const guard = read('scripts/qa/real-maps-fetch.mjs');
  assert(guard.includes('realMapsRequestLimit = 5')); assert(!guard.includes('computeRouteMatrix'));
  const protocol = read('docs/contracts/native-parent-search-booking-test.md');
  for (const required of ['Preparation only', 'nine potentially billable', 'independent restoration',
    'No map call has been authorized or executed', 'not two physical phones']) assert(protocol.includes(required), required);
  for (const id of ['search', 'booking']) assert.equal(content.flows.find(flow => flow.id === id).status, 'partial');
});
test('native and web integration gates retain the offline preparation contract without enabling provider execution', () => {
  const path = 'tests/parent-search-booking-preparation.test.mjs';
  for (const workflow of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const source = read('.github/workflows/' + workflow);
    assert.equal(source.split('"' + path + '"').length - 1, 2);
    assert(source.includes('run: node --test ' + path));
    assert(!source.includes('searchBookingApproved'));
  }
});
