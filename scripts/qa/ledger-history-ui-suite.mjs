import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { seedLedgerHistory } from './ledger-history-fixtures.mjs';
import { db, auth, call, signIn } from './local-flow-client.mjs';
import { withLocalAdminCleanup } from './local-admin-lifecycle.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { resetDisposableLocalApps } from './reset-disposable-local-apps.mjs';
import { installDisposableTestApks, disposableTestRunner } from './install-disposable-test-apks.mjs';

const root = resolve(import.meta.dirname, '../..'), directory = process.env.SGM_LOCAL_UI_OUTPUT;
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL;
assert(/^emulator-\d+$/.test(serial ?? ''));
const adb = `${process.env.ANDROID_HOME}/platform-tools/adb`;
const run = (command, args) => execFileSync(command, args, {env: process.env, encoding: 'utf8', timeout: 180_000, stdio: 'pipe'});
assert.equal(run(adb, ['-s', serial, 'shell', 'getprop', 'ro.kernel.qemu']).trim(), '1');
assert.equal(run(adb, ['-s', serial, 'emu', 'avd', 'name']).trim().split(/\r?\n/)[0], 'sgm_ledger_history_20261024');
mkdirSync(directory);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['scripts/qa/ledger-history-ui-suite.mjs', 'scripts/qa/run-ledger-history-ui.mjs',
  'scripts/qa/ledger-history-fixtures.mjs', 'scripts/qa/seed-firebase-emulator.mjs',
  ...['domain', 'services', 'callables'].map(folder => `functions/src/${folder}/ledgerSummaries.ts`),
  ...['FirebaseAndroidLedgerGateway', 'LedgerSummaryWire', 'FirebaseAndroidGateway'].map(name =>
    `android/app/src/main/java/be/sportgreenmoove/app/services/${name}.kt`),
  ...['RewardsScreen', 'ProfileScreen', 'ImpactScreen', 'AppDataState'].map(name =>
    `android/app/src/main/java/be/sportgreenmoove/app/ui/${name}.kt`),
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalLedgerHistoryFlowTest.kt'];
const sourceFiles = Object.fromEntries(sources.map(file => [file, sha(readFileSync(resolve(root, file)))]));
const apkHashes = Object.fromEntries(['apk/debug/app-debug.apk', 'apk/androidTest/debug/app-debug-androidTest.apk']
  .map(file => [file, sha(readFileSync(resolve(root, 'android/app/build/outputs', file)))]));
let result;
await withLocalAdminCleanup(async () => {
  const session = await seedLocalUiFixtures();
  const owner = 'sgm-qa-ledger-owner', foreign = 'sgm-qa-ledger-foreign';
  for (const [uid, email, displayName] of [[owner, 'ledger@example.test', 'Compte QA'], [foreign, 'ledger-foreign@example.test', 'Autre compte QA']]) {
    await auth.createUser({uid, email, displayName, password: session.password});
    await call('initializeUserProfile', await signIn(email));
  }
  await seedLedgerHistory(db, owner, foreign);
  const snapshot = async () => {
    const collections = (await db.listCollections()).map(row => row.id).sort();
    const documents = Object.fromEntries(await Promise.all(collections.map(async name => [name,
      (await db.collection(name).orderBy('__name__').get()).docs.map(doc => {
        const data = doc.data(); if (name === 'users' && [owner, foreign].includes(doc.id)) delete data.updatedAt;
        return {id: doc.id, data};
      })])));
    const accounts = await auth.listUsers(1000); assert(!accounts.pageToken);
    return {documents, claims: accounts.users.map(user => ({uid: user.uid, claims: user.customClaims ?? {}})).sort((a, b) => a.uid.localeCompare(b.uid))};
  };
  const before = await snapshot();
  let failure;
  try {
    resetDisposableLocalApps(adb, serial); installDisposableTestApks({adb, serial, android: resolve(root, 'android'), run});
    run(process.execPath, [resolve(root, 'scripts/qa/install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);
    const native = spawnSync(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-r', '-e', 'timeout_msec', '180000',
      '-e', 'class', 'be.sportgreenmoove.app.ui.LocalLedgerHistoryFlowTest',
      `be.sportgreenmoove.app.local.test/${disposableTestRunner}`], {encoding: 'utf8', timeout: 240_000, maxBuffer: 4 * 1024 * 1024});
    const transcript = String(native.stdout ?? '').replaceAll(session.password, '[REDACTED]');
    writeFileSync(resolve(directory, 'LocalLedgerHistoryFlowTest-instrumentation.txt'), transcript, {flag: 'wx'});
    assert.equal(native.status, 0, 'Native trial command must close successfully'); assertInstrumentationPassed(transcript, 1);
    collectLocalUiEvidence({adb, serial, evidenceDir: directory, phase: 'ledger-history', runId: session.runId, password: session.password});
    const marker = JSON.parse(readFileSync(resolve(directory, 'ledger-history-device.json')));
    assert.equal(marker.runId, session.runId); assert.equal(marker.completed, true);
    assert.equal(marker.balanceCents, -22_000); assert.equal(marker.rideCount, 257);
    assert.deepEqual(await snapshot(), before);
    for (const [file, hash] of Object.entries(sourceFiles)) assert.equal(sha(readFileSync(resolve(root, file))), hash);
    const names = ['impact', 'balance', 'restored', 'foreign', 'return'].map(name => `ledger-history-${name}.png`);
    result = {projectId: session.projectId, runId: session.runId, testedAt: new Date().toISOString(),
      scope: 'connected-isolated-android-ledger-history-not-physical', connectedCases: 1,
      nativeUiExecuted: true, balanceCents: -22_000, totalCo2Kg: 321.25, rideCount: 257, historyCount: 8,
      activityRecreation: true, fullProcessRestart: false, accountSwitch: true,
      protectedRecordsUnchanged: true, claimsUnchanged: true, physicalDevice: false, productionWrites: false,
      providerRequests: 0, sourceFiles, apkHashes,
      screenshots: Object.fromEntries(names.map(name => [name, sha(readFileSync(resolve(directory, name)))]))};
  } catch (error) {
    failure = error;
    try { collectLocalUiEvidence({adb, serial, evidenceDir: directory, phase: 'failure-cleanup', runId: session.runId, password: session.password}); }
    catch { console.warn('Partial capture unavailable; the original trial failure remains.'); }
  } finally {
    try { resetDisposableLocalApps(adb, serial); }
    catch (error) { failure = failure ? new AggregateError([failure, error], 'UI trial and package cleanup failed') : error; }
  }
  if (failure) throw failure;
}, {firestore: db});
writeFileSync(resolve(directory, 'results.json'), JSON.stringify({...result, localPackagesRemoved: true,
  adminClientClosed: true, firestoreClientTerminated: true, temporaryAdministrationUsed: false}, null, 2) + '\n', {flag: 'wx'});
console.log('Connected isolated ledger history passed; packages and clients closed.');
