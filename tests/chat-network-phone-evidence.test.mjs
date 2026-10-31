import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content, captures} from '../partner-portal/content.mjs';
import {chatNetworkPhoneFolder, validateChatNetworkPhone} from '../scripts/qa/chat-network-phone-evidence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
test('physical controlled retry retains exact stored records separately from real radio loss', () => {
  assert.deepEqual(validateChatNetworkPhone(root), {checkpoints: 8, messages: 2, notifications: 2,
    physicalControlledOfflineRetryAccepted: true, releaseAccepted: false});
  const flow = content.flows.find(row => row.id === 'messages');
  assert.equal(flow.checkedAt, '2026-10-31'); assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'phone');
  assert.equal(flow.networkRecoveryPhone.source, chatNetworkPhoneFolder + 'review.json');
  assert.equal(flow.images.length, 20); assert.equal(flow.tour.length, 6);
  assert(flow.tour.slice(0, 4).every(row => row.image.startsWith('chat-phone-')));
  assert.deepEqual(flow.tour.slice(4).map(row => row.image), ['chat-network-isolated-draft', 'chat-network-isolated-reply']);
  const review = JSON.parse(readFileSync(resolve(root, flow.networkRecoveryPhone.source)));
  for (const [name, path] of Object.entries(review.publishedCaptures)) assert.equal(captures[name], chatNetworkPhoneFolder + path);
  assert.equal(content.updates.find(row => row.flow === 'messages').source, chatNetworkPhoneFolder + 'README.md');
  assert.match(flow.remaining, /téléphones/);
});
for (const key of ['realWorldRadioLossAccepted', 'lostResponseAfterCommitAccepted', 'physicalTrackingAccepted',
  'independentProcessRestartAccepted', 'peerPhoneAccepted', 'pushDeliveryAccepted', 'iOSAccepted',
  'fullNativeGateAccepted', 'priorCopyFailureFixed', 'releaseAccepted', 'installedBytesIndependentlyAttested'])
  test('rehashing cannot promote controlled chat proof to ' + key, () => {
    const temp = mkdtempSync(resolve(tmpdir(), 'sgm-chat-phone-evidence-'));
    const folder = resolve(temp, chatNetworkPhoneFolder);
    try {
      cpSync(resolve(root, chatNetworkPhoneFolder), folder, {recursive: true});
      const archive = resolve(temp, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
      symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
      validateChatNetworkPhone(temp);
      const review = JSON.parse(readFileSync(resolve(folder, 'review.json'))); review[key] = true;
      const bytes = JSON.stringify(review); writeFileSync(resolve(folder, 'review.json'), bytes);
      const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
      hashes['review.json'] = createHash('sha256').update(bytes).digest('hex');
      writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
      assert.throws(() => validateChatNetworkPhone(temp), new RegExp(key));
    } finally {rmSync(temp, {recursive: true, force: true});}
  });
test('both workflows run controlled phone records and retained evidence without skipping a workload', () => {
  for (const name of ['native-ci', 'web-integration-smoke']) {
    const workflow = parseDocument(readFileSync(resolve(root, '.github/workflows', name + '.yml'), 'utf8')).toJSON();
    const steps = Object.values(workflow.jobs).flatMap(job => job.steps ?? []).filter(row => row.name === 'Validate controlled chat phone records and evidence');
    assert.equal(steps.length, 1);
    assert.equal(steps[0].run, 'node --test tests/chat-network-phone-checkpoints.test.mjs tests/chat-network-phone-evidence.test.mjs');
    assert.equal(steps[0].if, undefined); assert.equal(steps[0]['continue-on-error'], undefined);
    for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes('tests/chat-network-phone*.test.mjs'));
  }
});
