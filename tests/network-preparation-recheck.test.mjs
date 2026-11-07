import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {networkPreparationFolder, validateNetworkPreparationRecheck} from '../partner-portal/network-preparation-validation.mjs';
import {chatPreparationFolder, validateChatPreparationFailure} from '../scripts/qa/chat-preparation-failure-evidence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), base = join(root, networkPreparationFolder);
const json = file => JSON.parse(readFileSync(join(base, file)));
const expected = {nativeChatNetworkCasePassed: true, preservedPreparationFailure: true, nativeCases: 1,
  unchangedSourceFiles: 31, rootCauseProven: false, fullGateAccepted: false, releaseAccepted: false};

test('one unchanged native chat case passes while the earlier preparation failure stays failed', () => {
  assert.deepEqual(validateNetworkPreparationRecheck(root), expected);
});

function contradictory(file, change, t) {
  const temporary = mkdtempSync(join(tmpdir(), 'sgm-network-pair-'));
  t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const folder = join(temporary, networkPreparationFolder); cpSync(base, folder, {recursive: true});
  const archive = join(temporary, 'docs/release/evidence/source-archive'); mkdirSync(archive, {recursive: true});
  for (const hash of Object.values(json('review.json').sharedSourceFiles))
    cpSync(join(root, 'docs/release/evidence/source-archive', hash + '.txt'), join(archive, hash + '.txt'));
  assert.deepEqual(validateNetworkPreparationRecheck(temporary), expected);
  const value = json(file); change(value); const bytes = JSON.stringify(value);
  writeFileSync(join(folder, file), bytes);
  const hashes = json('artifact-sha256.json'); hashes[file] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateNetworkPreparationRecheck(temporary));
}

for (const key of ['changedTestConditions', 'defaultSelectionCauseProven', 'missingDefaultRepaired',
  'fullNativeGateAccepted', 'physicalDeviceAccepted', 'radioLossAccepted', 'postCommitLossAccepted',
  'productionWrites', 'releaseAccepted']) test('paired observations cannot promote ' + key, t => {
  contradictory('review.json', row => {row[key] = true;}, t);
});

for (const [file, change] of [
  ['failed/ui.json', row => {row.completed = true;}],
  ['pass/primary-copy.json', row => {row.status = 1;}],
  ['pass/bootstrap-subscriptions.json', row => {row.defaultSubscriptionValid.defaultDataSubId = false;}],
  ['failed/bootstrap-carrier.json', row => {row.configChangeSent = [true];}],
  ['failed/subscriptions-after.json', row => {row.defaultSubscriptionValid.defaultDataSubId = true;}],
  ['pass/disposable-device-restore.json', row => {row.restoration.installAdmin.originalPolicyRestored = false;}],
  ['failed/host-disposed.json', row => {row.targetExitObserved = false;}],
  ['pass/results.json', row => {row.network.duplicateMessages = 1;}],
  ['review.json', row => {row.sharedSourceFiles[Object.keys(row.sharedSourceFiles)[0]] = '0'.repeat(64);}],
]) test('rehashed contradictions remain rejected: ' + file, t => contradictory(file, change, t));

test('public progress adds no media or readiness promotion and retains physical receipt-loss history', () => {
  const flow = content.flows.find(row => row.id === 'messages');
  assert.equal(flow.networkPreparationRecheck.source, networkPreparationFolder + 'review.json');
  assert.equal(flow.status, 'partial'); assert.equal(flow.images.length, 34); assert.equal(flow.tour.length, 15);
  assert.equal(flow.postCommitReceiptLossPhone.checkedAt, '2026-11-01');
  assert.equal(flow.pendingSendRestartPhone.checkedAt, '2026-10-31');
  const progress = content.updates.find(row => row.source === networkPreparationFolder + 'README.md'); assert(progress);
  assert.match(progress.title, /simulation/); assert.equal(progress.flow, 'messages');
  assert.doesNotMatch(progress.title + progress.text, /BrowserStack|Firebase|SDK|APK|localhost|adbd/);
  assert.equal(json('review.json').screenshotsPublished, 0);
});

test('the paired evidence check runs in smoke without bypasses and both path triggers include its inputs', () => {
  const workflow = parseDocument(readFileSync(join(root, '.github/workflows/web-integration-smoke.yml'), 'utf8')).toJSON();
  const step = workflow.jobs.smoke.steps.filter(row => row.name === 'Validate paired native network preparation observations');
  assert.equal(step.length, 1); assert.equal(step[0].run, 'node --test tests/network-preparation-recheck.test.mjs');
  assert.equal(step[0]['continue-on-error'], undefined); assert.equal(step[0].if, undefined);
  for (const event of ['push', 'pull_request']) for (const file of ['tests/network-preparation-recheck.test.mjs',
    'scripts/diagnostics/retain-network-preparation-recheck.mjs',
    'scripts/diagnostics/retain-chat-preparation-failure.mjs']) assert(workflow.on[event].paths.includes(file));
});

test('the later focused failure stops before disconnection and preserves the earlier successes', () => {
  assert.deepEqual(validateChatPreparationFailure(root), {preparationFailed: true, messageResendExecuted: false,
    rootCauseConfirmed: false, releaseAccepted: false});
  const blocker = content.blockers.find(row => row.id === 'chat-send-stability');
  assert.equal(blocker.latestPreparation.source, chatPreparationFolder + 'review.json');
  assert.match(blocker.completeRecheck.source, /complete-checks-638066c/);
  assert.match(blocker.physicalControlledSource, /chat-network-phone-2026-10-31/);
  const progress = content.updates.find(row => row.source === chatPreparationFolder + 'README.md');
  assert(progress); assert.match(progress.title, /en simulation/);
  assert.equal(content.flows.find(row => row.id === 'messages').status, 'partial');
});

function contradictPreparation(file, change, t) {
  const temporary = mkdtempSync(join(tmpdir(), 'sgm-chat-preparation-'));
  t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const folder = join(temporary, chatPreparationFolder); cpSync(join(root, chatPreparationFolder), folder, {recursive: true});
  const read = name => JSON.parse(readFileSync(join(folder, name)));
  const value = read(file); change(value); const bytes = JSON.stringify(value);
  writeFileSync(join(folder, file), bytes);
  const hashes = read('artifact-sha256.json'); hashes[file] = createHash('sha256').update(bytes).digest('hex');
  if (file !== 'review.json') {
    const archive = read('archive-verification.json'); archive.members[file].sha256 = hashes[file];
    const encoded = JSON.stringify(archive); writeFileSync(join(folder, 'archive-verification.json'), encoded);
    hashes['archive-verification.json'] = createHash('sha256').update(encoded).digest('hex');
  }
  writeFileSync(join(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateChatPreparationFailure(temporary));
}

for (const key of ['messageResendExecuted', 'sourceSpecificFullGatePassed', 'rootCauseConfirmed',
  'previousSuccessInvalidated', 'physicalDeviceAccepted', 'productionWrites', 'releaseAccepted'])
  test('the later preparation failure cannot promote ' + key, t => contradictPreparation('review.json', row => {row[key] = true;}, t));
for (const [file, change] of [
  ['ui.json', row => {row.completed = true;}],
  ['subscriptions-before.json', row => {row.defaultSubscriptionValid.defaultDataSubId = true;}],
  ['device-restore.json', row => {row.verified = false;}],
]) test('the later failure rejects rehashed contradictions: ' + file, t => contradictPreparation(file, change, t));
