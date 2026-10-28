import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {networkRecheckIdentity as identity, validateChatNetworkRecheck} from './chat-network-recheck-evidence.mjs';

const input = process.argv[2]; assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), destination = resolve(root, identity.folder);
assert(!existsSync(destination), 'Original evidence cannot be overwritten'); mkdirSync(destination);
const local = resolve(input, 'local-ui-evidence', identity.runId);
const device = resolve(input, 'focused-safety-ui/chat-network-recovery');
const files = [];
for (const file of ['chat-network-recovery-results.json', 'chat-network-recovery-app-results.json',
  'local-chat-network-ui.json', 'LocalChatNetworkFlowTest-instrumentation.txt', 'adb-pull-network-recovery.json']) {
  copyFileSync(resolve(local, file), resolve(destination, file)); files.push(file);
}
for (const file of ['disposable-device-setup.json', 'disposable-device-restore.json', 'chat-network-recovery-suite-status.json']) {
  copyFileSync(resolve(device, file), resolve(destination, file)); files.push(file);
}
const save = (file, data) => { writeFileSync(resolve(destination, file), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'}); files.push(file); };
const gh = path => JSON.parse(execFileSync('gh', ['api', path], {encoding: 'utf8', timeout: 30_000}));
save('job.json', gh(`repos/MohamedRed/Sports-Green-Moove/actions/jobs/${identity.jobId}`));
save('artifact.json', gh(`repos/MohamedRed/Sports-Green-Moove/actions/artifacts/${identity.artifactId}`));
const run = JSON.parse(readFileSync(resolve(destination, 'chat-network-recovery-results.json')));
for (const [file, hash] of Object.entries(run.sourceFiles)) {
  const bytes = execFileSync('git', ['show', `${identity.head}:${file}`]);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  const archived = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archived)) assert.deepEqual(readFileSync(archived), bytes);
  else writeFileSync(archived, bytes, {flag: 'wx'});
}
save('artifact-sha256.json', Object.fromEntries(files.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex')])));
validateChatNetworkRecheck(root, {source: identity.folder + 'chat-network-recovery-results.json', checkedAt: identity.date});
console.log('One isolated network recovery, primary copy and independent restoration validated; no new public media or release acceptance.');
