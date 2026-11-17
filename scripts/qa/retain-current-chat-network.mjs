import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {content} from '../../partner-portal/content.mjs';
import {retainChatNetworkRecheck} from './retain-chat-network-replay.mjs';
import {currentChatNetworkIdentity as expected, currentChatArchiveFiles, validateCurrentChatNetwork} from './chat-network-current-evidence.mjs';

const input = process.argv[2], zip = process.argv[3]; assert(isAbsolute(input ?? '') && isAbsolute(zip ?? ''));
const root = resolve(import.meta.dirname, '../..'), folder = resolve(root, expected.folder);
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), bytes = readFileSync(zip);
assert.equal(sha(bytes), expected.archiveSha256);
retainChatNetworkRecheck(input, expected);
const artifact = JSON.parse(readFileSync(resolve(folder, 'artifact.json'), 'utf8'));
assert.equal(artifact.digest, 'sha256:' + sha(bytes)); assert.equal(artifact.size_in_bytes, bytes.length);
const members = [];
for (const {member, file} of currentChatArchiveFiles) {
  const original = execFileSync('unzip', ['-p', zip, member]);
  if (file === 'host-shutdown.json') writeFileSync(resolve(folder, file), original, {flag: 'wx'});
  assert.deepEqual(readFileSync(resolve(folder, file)), original);
  members.push({member, file, bytes: original.length, sha256: sha(original)});
}
const save = (file, value) => writeFileSync(resolve(folder, file), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
save('archive-receipt.json', {artifactId: expected.artifactId, sha256: sha(bytes), bytes: bytes.length, members});
save('portal-before.json', {flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))});
const path = resolve(folder, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(path, 'utf8'));
for (const file of ['host-shutdown.json', 'archive-receipt.json', 'portal-before.json']) hashes[file] = sha(readFileSync(resolve(folder, file)));
writeFileSync(path, JSON.stringify(hashes, null, 2) + '\n');
validateCurrentChatNetwork(root);
console.log('Exact archive, native recovery, independent stored-state verification, installation-policy restoration and passive host exit validated; no physical-device or release acceptance.');
