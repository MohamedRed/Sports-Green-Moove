import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auth, db, call, signIn } from './local-flow-client.mjs';
import { getDatabase } from 'firebase-admin/database';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { seedSearchBookingFixture } from './search-booking-fixture.mjs';
import { snapshotSearchBookingRecords } from './search-booking-records.mjs';
import { withLocalAdminCleanup } from './local-admin-lifecycle.mjs';

assert.equal(process.env.SGM_SEARCH_BOOKING_APPROVAL, 'one-trial-max-eight-requests');
await withLocalAdminCleanup(async () => {
  const session = await seedLocalUiFixtures();
  for (const email of [session.parent, session.driver]) await call('initializeUserProfile', await signIn(email));
  const plan = JSON.parse(process.env.SGM_SEARCH_BOOKING_PLAN), fixture = await seedSearchBookingFixture(plan);
  const baseline = JSON.parse(JSON.stringify(await snapshotSearchBookingRecords(db, auth, getDatabase())));
  writeFileSync(resolve(process.env.SGM_SEARCH_BOOKING_PHONE_OUTPUT, 'baseline.json'),
    JSON.stringify({projectId: session.projectId, runId: session.runId, fixture, plan, baseline}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  writeFileSync(process.env.SGM_LOCAL_UI_SESSION_FILE, JSON.stringify({...session, searchBooking: {...fixture, plan}}), {mode: 0o600});
  console.log('Isolated search-phone fixture ready. Provider budget is unused until explicit app search actions.');
  console.log(JSON.stringify({tripTitle: 'Trajet QA recherche deux places', departureAt: fixture.departureAt,
    seats: 4, priceCents: 0, queries: ['Gare de Wavre', 'Gare de Bruxelles-Central']}));
  await new Promise(done => {
    const timer = setInterval(() => {}, 60_000);
    const stop = () => {clearInterval(timer); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); done();};
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  });
}, {firestore: db});
