import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {copy376Folder} from './native-copy-376-evidence.mjs';

const [zip] = process.argv.slice(2); assert.equal(process.argv.length, 3); assert(isAbsolute(zip ?? ''));
const root = resolve(import.meta.dirname, '../..'), base = resolve(root, copy376Folder);
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), bytes = readFileSync(zip);
assert.equal(bytes.length, 52662); assert.equal(sha(bytes), 'e9cb44a3df4cab7beffe3d887292159c45aa254d61bae6566e7eb3fc3232cffa');
const hashesPath = resolve(base, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(hashesPath)), members = [];
for (const name of ['outcome.json', 'sample-000.json', 'sample-058.json', 'chat-network-validation-before.json']) {
  const member = 'outputs/store-review-screenshots/network-readiness/' + name;
  const original = execFileSync('unzip', ['-p', zip, member]), file = 'later-prerequisite-' + name;
  assert(!existsSync(resolve(base, file))); writeFileSync(resolve(base, file), original, {flag: 'wx'}); hashes[file] = sha(original);
  members.push({member, file, bytes: original.length, sha256: sha(original)});
}
const run = JSON.parse(execFileSync('gh', ['run', 'view', '42266248833', '--repo', 'MohamedRed/Sports-Green-Moove',
  '--json', 'databaseId,headSha,status,conclusion,jobs'], {encoding: 'utf8'}));
assert.equal(run.headSha, '04c9fba781897bb8e567475b845f42bcc7beb658');
assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
const job = run.jobs.find(row => row.databaseId === 128058812440); assert.equal(job.conclusion, 'failure');
const file = 'later-prerequisite-archive.json'; assert(!existsSync(resolve(base, file)));
const record = {sourceCommit: run.headSha, workflowId: run.databaseId, jobId: job.databaseId,
  status: job.status, conclusion: job.conclusion, artifactId: 13526919229, bytes: bytes.length, sha256: sha(bytes), members};
const serialized = JSON.stringify(record, null, 2) + '\n'; writeFileSync(resolve(base, file), serialized, {flag: 'wx'}); hashes[file] = sha(serialized);
writeFileSync(hashesPath, JSON.stringify(hashes, null, 2) + '\n');
console.log('Later fixed-budget prerequisite failure retained separately; no app was installed or flow accepted.');
