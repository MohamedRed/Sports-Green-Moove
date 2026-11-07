import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {chatPreparationFolder, validateChatPreparationFailure} from '../qa/chat-preparation-failure-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), folder = resolve(root, chatPreparationFolder);
const [zip, jobPath, artifactPath] = process.argv.slice(2);
assert([zip, jobPath, artifactPath].every(path => isAbsolute(path ?? '')));
assert(!existsSync(folder), 'Never replace an original failure');
const artifact = JSON.parse(readFileSync(artifactPath)), archive = readFileSync(zip);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(artifact.id, 13142393131); assert.equal(archive.length, artifact.size_in_bytes);
assert.equal('sha256:' + sha(archive), artifact.digest);
mkdirSync(folder);
const save = (file, value) => writeFileSync(resolve(folder, file), Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
save('job.json', readFileSync(jobPath)); save('artifact.json', readFileSync(artifactPath));
const local = 'local-ui-evidence/940392e133a7bbb3f059fa69948111c3/';
const device = 'focused-safety-ui/chat-network-recovery/';
const members = {};
for (const [file, member] of Object.entries({
  'ui.json': local + 'local-chat-network-ui.json',
  'instrumentation.txt': local + 'LocalChatNetworkFlowTest-instrumentation.txt',
  'subscriptions-before.json': local + 'chat-subscriptions-before.json',
  'subscriptions-after.json': local + 'chat-subscriptions-after.json',
  'selection-after.json': local + 'chat-default-selection-after.json',
  'carrier-after.json': local + 'chat-carrier-after.json',
  'bootstrap-subscriptions.json': device + 'network-bootstrap/chat-subscriptions-before.json',
  'bootstrap-properties.json': device + 'network-bootstrap/log-emission-properties.json',
  'wifi-readiness.json': device + 'network-readiness/outcome.json',
  'suite-status.json': device + 'chat-network-recovery-suite-status.json',
  'device-restore.json': device + 'disposable-device-restore.json',
  'host-disposed.json': device + 'host-shutdown/complete.json',
})) {
  const bytes = execFileSync('/usr/bin/unzip', ['-p', zip, member], {maxBuffer: 2 * 1024 * 1024});
  save(file, bytes); members[file] = {member, sha256: sha(bytes)};
}
save('archive-verification.json', {sha256: sha(archive), bytes: archive.length, members});
save('review.json', {scope: 'focused-chat-network-preparation-failure-not-message-resend-or-cause-proof',
  sourceCommit: '30272e0ca56d3c50ffdf0258f8a13eabf1b49d9f', workflowId: 41445572945,
  jobId: 125277691092, artifactId: 13142393131, testedAt: '2026-11-02',
  networkPreparationFailed: true, draftReached: true, mobileDefaultAvailable: false,
  messageResendExecuted: false, sourceSpecificFullGatePassed: false, rootCauseConfirmed: false,
  previousSuccessInvalidated: false, physicalDeviceAccepted: false, productionWrites: false,
  changedTestConditions: false, releaseAccepted: false, publishedMedia: []});
save('artifact-sha256.json', Object.fromEntries(readdirSync(folder).map(file => [file, sha(readFileSync(resolve(folder, file)))])));
validateChatPreparationFailure(root);
console.log('Original focused preparation failure retained; no resend, cause, physical or release acceptance.');
