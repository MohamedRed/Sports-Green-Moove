import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {nativeFollowup as identity, validateNativeFollowup} from './native-followup-evidence.mjs';

const [teamInput, networkInput] = process.argv.slice(2);
assert([teamInput, networkInput].every(path => isAbsolute(path ?? '')));
const root = resolve(import.meta.dirname, '../..'), destination = resolve(root, identity.folder);
assert(!existsSync(destination), 'Original evidence cannot be overwritten');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [name, input, phase, filenames] of [
  ['team', teamInput, 'team-conversation', ['team-conversation-results.json', 'team-conversation-app-results.json',
    'team-conversation-device.json', 'LocalTeamConversationFlowTest-instrumentation.txt', 'adb-pull-team-conversation.json']],
  ['network', networkInput, 'chat-network-recovery', ['chat-network-recovery-results.json', 'chat-network-recovery-app-results.json',
    'local-chat-network-ui.json', 'LocalChatNetworkFlowTest-instrumentation.txt', 'adb-pull-network-recovery.json',
    'chat-network-validation-before.json', 'chat-network-validation-after.json']],
]) {
  const base = resolve(destination, name), local = resolve(input, 'local-ui-evidence', identity[name].runId);
  mkdirSync(base, {recursive: true});
  const copy = (from, file) => copyFileSync(resolve(from, file), resolve(base, file));
  for (const file of filenames) copy(local, file);
  if (name === 'team') {
    const marker = JSON.parse(readFileSync(resolve(local, 'team-conversation-device.json')));
    for (const file of Object.keys(marker.screenshots)) copy(local, file);
  }
  for (const file of ['disposable-device-setup.json', 'disposable-device-restore.json', phase + '-suite-status.json'])
    copy(resolve(input, 'focused-safety-ui', phase), file);
  for (const [file, path] of [['job.json', 'jobs/' + identity[name].jobId], ['artifact.json', 'artifacts/' + identity[name].artifactId]]) {
    const data = execFileSync('gh', ['api', 'repos/MohamedRed/Sports-Green-Moove/actions/' + path], {timeout: 60_000});
    writeFileSync(resolve(base, file), data, {flag: 'wx'});
  }
  const result = JSON.parse(readFileSync(resolve(base, phase + '-results.json')));
  for (const [file, expected] of Object.entries(result.sourceFiles)) {
    const bytes = execFileSync('git', ['show', identity.head + ':' + file]); assert.equal(hash(bytes), expected, file);
    const archive = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
    if (existsSync(archive)) assert.deepEqual(readFileSync(archive), bytes); else writeFileSync(archive, bytes, {flag: 'wx'});
  }
  const hashes = Object.fromEntries(readdirSync(base).map(file => [file, hash(readFileSync(resolve(base, file)))]));
  writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', {flag: 'wx'});
}
validateNativeFollowup(root);
console.log('Both independent native cases, saved-state verification, primary transfers and disposal validated. No whole-gate or physical acceptance.');
