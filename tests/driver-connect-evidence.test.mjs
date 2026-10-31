import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {validateDriverConnectEvidence} from '../scripts/qa/driver-connect-evidence.mjs';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {content, captures} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), base = 'docs/release/evidence/driver-connect-2026-10-24/';
const read = file => readFileSync(resolve(root, file), 'utf8'), json = file => JSON.parse(read(file));
test('original device cases, rejected captures and restored-source units retain their different scopes and dates', () => {
  const summary = validateDriverConnectEvidence(root, base + 'summary.json');
  assert.equal(summary.componentTestedAt.slice(0, 10), '2026-10-24'); assert.equal(summary.checkedAt, '2026-10-25');
});
for (const [file, change] of [
  ['summary.json', v => {v.realOnboarding = true;}], ['summary.json', v => {v.physicalDevice = true;}],
  ['summary.json', v => {v.iosTested = true;}], ['summary.json', v => {v.releaseComplete = true;}],
  ['layout/results.json', v => {v.completed = false;}], ['layout/results.json', v => {v.providerRequests = 1;}],
  ['visual-review.json', v => {v.originalThreeCaseNarrowAccepted = true;}],
  ['visual-review.json', v => {v.finalTwoCapturesAccepted = false;}],
  ['host-cleanup.json', v => {v.emulator5554Absent = false;}], ['units/run.json', v => {v.completed = false;}],
  ['red/results.json', v => {v.completed = true;}],
]) test('coherently rehashed unsupported account-preparation proof is rejected: ' + file + ' ' + change, t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-connect-proof-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(resolve(root, base), resolve(temp, base), {recursive: true});
  const archive = 'docs/release/evidence/source-archive'; mkdirSync(resolve(temp, archive), {recursive: true});
  const hashes = new Set(['red', 'green', 'layout', 'startup-failure', 'startup-failure-2', 'units'].flatMap(phase =>
    Object.values(json(base + phase + (phase === 'units' ? '/run.json' : '/results.json')).sourceFiles)));
  for (const hash of hashes) cpSync(resolve(root, archive, hash + '.txt'), resolve(temp, archive, hash + '.txt'));
  const row = json(base + file); change(row); const bytes = JSON.stringify(row);
  writeFileSync(resolve(temp, base, file), bytes);
  const checksums = json(base + 'artifact-sha256.json'); checksums[file] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(temp, base, 'artifact-sha256.json'), JSON.stringify(checksums));
  assert.throws(() => validateDriverConnectEvidence(temp, base + 'summary.json'));
});
test('the real route owns identity-aware work and the shared button retains wrapped text', () => {
  const route = read('android/app/src/main/java/be/sportgreenmoove/app/ui/PaymentsRoute.kt');
  for (const value of ['rememberCoroutineScope()', 'rememberUpdatedState(sessionUid', 'StripeConnectCoordinator(providers.stripe',
    'loading = blocked || connect.busy', 'connect.start(urls, uriHandler::openUri)']) assert(route.includes(value));
  assert(!/launchStripeConnectOnboarding|Configurez SGM_|Adresse email Firebase/.test(route));
  assert(read('android/app/src/main/java/be/sportgreenmoove/app/ui/PaymentsConnectCard.kt').includes('enabled = !loading'));
  assert(read('android/app/src/main/java/be/sportgreenmoove/app/ui/V2Components.kt').includes('.heightIn(min = size.height)'));
  const smoke = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(smoke.split('"tests/driver-connect-evidence.test.mjs"').length - 1, 2);
  assert(smoke.includes('run: node --test tests/driver-connect-evidence.test.mjs'));
});
test('the portal publishes only the final original captures and retains historical payment proof', () => {
  const flow = content.flows.find(row => row.id === 'payments'); assert.equal(flow.status, 'partial');
  assert.equal(flow.checkedAt, '2026-10-25'); assert.equal(flow.ui.checkedAt, '2026-10-18');
  assert.equal(flow.local.checkedAt, '2026-10-18');
  assert(flow.ui.source.includes('2026-10-18')); assert.equal(flow.tour.length, 2);
  for (const step of flow.tour) assert(captures[step.image].startsWith(base + 'layout/'));
  assert(flow.images.some(image => image.file === 'payment-pending-narrow'));
  assert(!/BrowserStack|Firebase|SDK|Stripe Connect/.test([flow.summary, flow.verified, flow.remaining].join(' ')));
  assert.match(flow.remaining, /commission/); assert.match(flow.remaining, /réels/);
});
test('the original SDK failure remains a preparation failure, not a failed app assertion or a green replay', () => {
  const folder = 'docs/release/evidence/native-setup-8c9851e5-2026-10-24/'; assertEvidenceBundleChecksums(resolve(root, folder));
  const run = json(folder + 'run.json'), summary = json(folder + 'summary.json');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure'); assert.equal(run.headSha, summary.sourceCommit);
  assert.equal(run.jobs.find(job => job.databaseId === 120914862477).conclusion, 'failure');
  for (const key of ['emulatorLaunched', 'ordinarySuiteExecuted', 'authenticatedReplayExecuted', 'releaseComplete']) assert.equal(summary[key], false);
  assert.match(read(folder + 'sdk-installation.txt'), /Error on ZipFile unknown archive/);
});
