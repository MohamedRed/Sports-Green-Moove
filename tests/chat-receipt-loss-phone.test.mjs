import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {content, captures} from '../partner-portal/content.mjs';
import {chatReceiptCaptures} from '../partner-portal/chat-receipt-loss-phone.mjs';
import {chatReceiptPhoneFolder, chatReceiptPhoneImages, assertChatReceiptPhoneReview, validateChatReceiptPhone}
  from '../scripts/qa/chat-receipt-loss-phone-evidence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), base = join(root, chatReceiptPhoneFolder);
const json = file => JSON.parse(readFileSync(join(base, file)));
test('a real isolated phone reconciles one independently committed message despite its lost reply', () => {
  assert.deepEqual(validateChatReceiptPhone(root), {postCommitReplyLossOnOnePhysicalPhonePassed: true,
    checkpoints: 8, messages: 1, notifications: 1, explicitRetryExercised: false, peerPhoneAccepted: false,
    realRadioLossAccepted: false, releaseAccepted: false});
});
test('the new three-image tour retains all 31 prior images and 12 prior steps, with a partial flow', () => {
  const flow = content.flows.find(row => row.id === 'messages'); assert.equal(flow.status, 'partial');
  assert.equal(flow.postCommitReceiptLossPhone.source, chatReceiptPhoneFolder + 'review.json');
  const files = Object.keys(chatReceiptCaptures);
  assert.deepEqual(flow.images.slice(0, 3).map(row => row.file), files);
  assert.deepEqual(flow.tour.slice(0, 3).map(row => row.image), files);
  assert.equal(flow.images.length, 34); assert.equal(flow.tour.length, 15);
  for (const [id, path] of Object.entries(chatReceiptCaptures)) assert.equal(captures[id], path);
  assert.equal(flow.pendingSendRestartPhone.checkedAt, '2026-10-31');
  assert.equal(flow.pendingSendAccountSwitchPhone.checkedAt, '2026-11-01');
  assert.match(flow.remaining, /deux téléphones/); assert.match(flow.remaining, /iPhone/);
  const progress = content.updates.find(row => row.source === chatReceiptPhoneFolder + 'README.md'); assert(progress);
  assert.doesNotMatch(progress.title + progress.text + flow.summary + flow.verified, /BrowserStack|Firebase|SDK|APK|localhost|adbd/);
  assert.equal(content.blockers.find(row => row.id === 'chat-pending-restart').accountSwitchHistory.source,
    'docs/release/evidence/chat-account-switch-phone-2026-11-01/README.md');
});
test('public session crops retain the exact pixels of their original browser captures', () => {
  for (const name of chatReceiptPhoneImages) {
    const decode = (file, filters = []) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error',
      '-i', join(base, file), ...filters, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {maxBuffer: 1_000_000});
    assert.deepEqual(decode('captures/' + name + '.png'), decode('original-session-captures/' + name + '.png',
      ['-vf', 'crop=274:618:615:109:exact=1']));
  }
});
for (const key of ['explicitRetryExercised', 'processRestartAccepted', 'peerPhoneAccepted', 'realRadioLossAccepted',
  'trackingAccepted', 'iOSAccepted', 'pushDeliveryAccepted', 'productionWrites', 'realPayments', 'applicationDeployed',
  'installedBytesIndependentlyAttested', 'wholeCurrentApkAttested', 'releaseAccepted', 'videoProduced',
  'screenSharingPermissionsChanged', 'chromeRestarted']) test('this trial cannot promote ' + key, () => {
  const review = json('review.json'); review[key] = true;
  assert.throws(() => assertChatReceiptPhoneReview(review), new RegExp(key));
});
for (const [file, change] of [
  ['records/receipt-lost.json', row => {row.proxy.attempts[0].responseReleased = true;}],
  ['records/parent-confirmed.json', row => {row.state.documents.messages.push(row.state.documents.messages.at(-1));}],
  ['records/driver-visible.json', row => {row.state.claims = [];}],
  ['records/session-results.json', row => {row.controllerSubmittedChatMessages = true;}],
  ['records/session-results.json', row => {row.proxy.attempts[0].clientMessageId = '22222222-2222-4222-8222-222222222222';}],
  ['failed-attempt/session-results.json', row => {row.completed = true;}],
  ['disposal.json', row => {row.packageAbsenceIndependentlyVerified = true;}],
]) test('rehashed contradictory observations remain rejected: ' + file + ' / ' + change.toString(), t => {
  const temporary = mkdtempSync(join(tmpdir(), 'sgm-chat-receipt-proof-')); t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const folder = join(temporary, chatReceiptPhoneFolder); cpSync(base, folder, {recursive: true});
  const archive = join(temporary, 'docs/release/evidence/source-archive'); mkdirSync(archive, {recursive: true});
  for (const record of ['records/session-results.json', 'failed-attempt/session-results.json']) for (const hash of Object.values(json(record).sourceFiles))
    cpSync(join(root, 'docs/release/evidence/source-archive', hash + '.txt'), join(archive, hash + '.txt'));
  assert.doesNotThrow(() => validateChatReceiptPhone(temporary));
  const value = json(file); change(value); const bytes = JSON.stringify(value); writeFileSync(join(folder, file), bytes);
  const hashes = json('artifact-sha256.json'); hashes[file] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateChatReceiptPhone(temporary));
});
