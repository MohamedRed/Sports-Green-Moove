import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { deleteApp, getApp } from 'firebase-admin/app';
import { auth, call, db, signIn } from './local-flow-client.mjs';
import { verifyChildContactParent } from './child-emergency-fixture.mjs';

const root = resolve(import.meta.dirname, '../..'), output = process.env.SGM_INVITATION_BROWSER_OUTPUT;
assert.equal(process.env.GCLOUD_PROJECT, 'demo-sgm-local-qa');
assert(output?.startsWith('/'));
execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const parent = await signIn('p@example.test'), manager = await signIn('c@example.test');
await verifyChildContactParent({ parent, manager }, 'sgm-qa-child-lina', 'sgm-qa-club-green-wavre');
const view = await call('getEmergencyContact', parent, { target: {
  kind: 'child', childId: 'sgm-qa-child-lina', clubId: 'sgm-qa-club-green-wavre' } });
const target = { childId: 'sgm-qa-child-lina', clubId: 'sgm-qa-club-green-wavre', expectedChildInstanceId: view.childInstanceId };
const invitation = await call('createChildInvitation', parent, target);
const baseline = new Map((await auth.listUsers()).users.map(user => [user.uid, user.customClaims]));
assert.equal(baseline.size, 3);
const token = new URL(invitation.url).hash;
const observations = [];
const files = ['scripts/qa/start-child-invitation-browser.mjs', 'scripts/qa/child-invitation-browser-runtime.mjs',
  'admin/src/main.tsx', 'admin/src/ChildInvitationPage.tsx', 'admin/src/childInvitationLink.ts',
  'admin/src/childInvitationGateway.ts', 'admin/src/firebase.ts', 'admin/src/localFirebaseConfig.ts'];
const sourceFiles = Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]));
const inspect = async phase => {
  assert(['before', 'mismatch', 'created'].includes(phase));
  assert.equal(observations.length, ['before', 'mismatch', 'created'].indexOf(phase), 'Observe each phase once, in order');
  const users = (await auth.listUsers()).users;
  for (const user of users) if (baseline.has(user.uid)) assert.deepEqual(user.customClaims, baseline.get(user.uid));
  const record = await db.collection('childAccountInvitations').doc(invitation.invitationHash).get();
  assert.equal((await db.collection('childAccountLinks').get()).size, 0, 'Browser signup must not approve the child link');
  if (phase === 'created') {
    const newUsers = users.filter(user => !baseline.has(user.uid)); assert.equal(newUsers.length, 1);
    const user = newUsers[0]; assert.equal(user.disabled, false); assert.equal(user.email, 'browser-child@example.test');
    assert.deepEqual(user.customClaims, { roleKeys: ['child'], childInvitationHash: invitation.invitationHash });
    const profile = await db.collection('users').doc(user.uid).get();
    assert.deepEqual(profile.get('roles'), { admin: false, child: true, clubManager: false, driver: false, parent: false });
    assert.equal(profile.get('childInvitationHash'), invitation.invitationHash);
    assert.equal(record.get('accountUserId'), user.uid); assert.equal(record.get('status'), 'accepted');
    assert.equal(record.get('attemptCount'), 1, 'One browser submit must issue one redemption');
    if (process.env.SGM_INVITATION_PHONE_SESSION_FILE) writeFileSync(process.env.SGM_INVITATION_PHONE_SESSION_FILE,
      JSON.stringify({projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, password: process.env.SGM_QA_PASSWORD,
        fixtureProvenance: 'isolated-browser-created-child', fixture: {parentUid: parent.uid, childUid: user.uid,
          childId: target.childId, clubId: target.clubId, childInstanceId: target.expectedChildInstanceId,
          childName: view.childName, parentEmail: 'p@example.test', childEmail: user.email}}), {flag: 'wx', mode: 0o600});
  } else {
    assert.equal(users.length, baseline.size); assert.equal(record.get('status'), 'pending');
    assert.equal(record.get('attemptCount') ?? 0, 0);
  }
  const observation = { phase, checkedAt: new Date().toISOString(), userCount: users.length,
    invitationStatus: record.get('status'), redemptionRequests: record.get('attemptCount') ?? 0,
    parentApprovalCount: 0, originalRolesUnchanged: true };
  observations.push(observation);
  const report = { scope: 'isolated-connected-browser-signup-not-native-share-or-phone-approval',
    projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, observations, sourceFiles,
    verifiedAt: new Date().toISOString(), applicationHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    nativeUiExecuted: false, physicalDevice: false, productionWrites: false, providerRequests: 0,
    parentApprovalSeparate: true, accountCreatedThroughBrowser: phase === 'created' };
  const encoded = JSON.stringify(report, null, 2) + '\n';
  assert(!encoded.includes(token.slice(1))); assert(!encoded.includes(process.env.SGM_QA_PASSWORD));
  writeFileSync(resolve(output, 'observations.json'), encoded, { mode: 0o600 });
  return observation;
};
process.env.VITE_USE_FIREBASE_EMULATOR = 'true';
const server = await createServer({ root: resolve(root, 'admin'),
  server: { host: '127.0.0.1', port: 4185, strictPort: true },
  plugins: [{ name: 'isolated-invitation-entry-and-observation', configureServer(vite) {
    vite.middlewares.use((request, response, next) => {
      if (!request.url?.startsWith('/__qa/invitation-')) return next();
      response.setHeader('Cache-Control', 'no-store'); response.setHeader('Referrer-Policy', 'no-referrer');
      if (request.url === '/__qa/invitation-entry' && request.method === 'GET') {
        response.writeHead(302, { Location: '/child-invitation' + token }); response.end(); return;
      }
      if (request.url === '/__qa/invitation-mobile' && request.method === 'GET') {
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><html><head><title>Isolated mobile signup</title></head><body style="margin:0"><iframe title="Invitation enfant" src="/__qa/invitation-entry" style="display:block;width:390px;height:900px;border:0"></iframe></body></html>'); return;
      }
      const phase = request.url.match(/^\/__qa\/invitation-observe\/(before|mismatch|created)$/)?.[1];
      if (!phase || request.method !== 'POST') { response.writeHead(404); response.end(); return; }
      // Only the local QA controller can record an observation, never an app page.
      if (request.headers.origin || request.headers['x-sgm-local-observer'] !== process.env.SGM_LOCAL_RUN_ID) {
        response.writeHead(403); response.end(); return;
      }
      inspect(phase).then(value => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)); })
        .catch(() => { response.writeHead(409); response.end('Observation rejected; retain the original attempt.'); });
    });
  } }],
});
try {
  await server.listen();
  if (process.env.SGM_INVITATION_PHONE_SESSION_FILE) writeFileSync(process.env.SGM_INVITATION_PHONE_SESSION_FILE + '.signup',
    JSON.stringify({projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
      password: process.env.SGM_QA_PASSWORD, email: 'browser-child@example.test'}), {flag: 'wx', mode: 0o600});
  writeFileSync(resolve(output, 'controller.json'), JSON.stringify({ runId: process.env.SGM_LOCAL_RUN_ID }), { flag: 'wx', mode: 0o600 });
  console.log('Connected invitation browser ready at http://127.0.0.1:4185/__qa/invitation-mobile');
  await new Promise(resolveStop => {
    const timer = setInterval(() => {}, 60_000);
    const stop = () => { clearInterval(timer); resolveStop(); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  });
} finally { await server.close(); await db.terminate(); await deleteApp(getApp()); }
