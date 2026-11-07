import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { deleteApp } from 'firebase-admin/app';
import { db } from './local-flow-client.mjs';
import { seedChildAccountPhoneFixture } from './child-account-phone-fixture.mjs';
import { withLocalAdminCleanup } from './local-admin-lifecycle.mjs';

let adminClientClosed = false, firestoreClientTerminated = false;
const fixture = await withLocalAdminCleanup(seedChildAccountPhoneFixture, {
  firestore: { terminate: async () => { await db.terminate(); firestoreClientTerminated = true; } },
  closeApp: async app => { await deleteApp(app); adminClientClosed = true; },
});
const sources = ['scripts/qa/child-account-phone-runtime.mjs', 'scripts/qa/child-account-phone-fixture.mjs',
  'scripts/qa/seed-firebase-emulator.mjs', 'scripts/qa/child-emergency-fixture.mjs'];
writeFileSync(process.env.SGM_LOCAL_UI_SESSION_FILE, JSON.stringify({ projectId: 'demo-sgm-local-qa',
  runId: process.env.SGM_LOCAL_RUN_ID, password: process.env.SGM_QA_PASSWORD, fixture }), { flag: 'wx', mode: 0o600 });
writeFileSync(resolve(process.env.SGM_CHILD_ACCOUNT_PHONE_OUTPUT, 'fixture-ready.json'), JSON.stringify({
  projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, fixture,
  preparedAt: new Date().toISOString(), scope: 'isolated-fixture-not-child-signup-or-phone-proof',
  childAccountProvisionedByFixture: true, accountLinkPreseeded: false, approvalCodePreseeded: false,
  adminClientClosed, firestoreClientTerminated, productionWrites: false,
  sourceFiles: Object.fromEntries(sources.map(file => [file,
    createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')])),
}, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log('Isolated child-account phone fixture ready; setup clients are closed.');
await new Promise(resolveStop => {
  const keepAlive = setInterval(() => {}, 60_000);
  const stop = () => { clearInterval(keepAlive); resolveStop(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
});
