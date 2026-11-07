import assert from 'node:assert/strict';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import { captureWindowFolder, validateCaptureWindowEvidence } from './capture-window-evidence.mjs';

const input = process.argv[2]; assert(isAbsolute(input ?? ''));
const root = resolve(import.meta.dirname, '../..'), target = resolve(root, captureWindowFolder);
assert(!existsSync(resolve(target, 'artifact-sha256.json')), 'An original collection cannot be overwritten');
for (const mode of ['baseline', 'candidate']) {
  const from = resolve(input, `capture-window-${mode}`), into = resolve(target, mode);
  assert(!existsSync(into)); mkdirSync(into, { recursive: true });
  for (const name of ['results.json', 'instrumentation.txt', 'device-setup.json', 'device-restored.json', 'primary-copy.json', 'primary-files.json'])
    copyFileSync(resolve(from, name), resolve(into, name), 1);
  for (const folder of ['images', 'capture-timing']) cpSync(resolve(from, folder), resolve(into, folder), { recursive: true, force: false, errorOnExist: true });
  const result = JSON.parse(readFileSync(resolve(from, 'results.json')));
  for (const hash of Object.values(result.sourceFiles)) {
    const source = readFileSync(resolve(from, 'sources', hash + '.txt'));
    assert.equal(createHash('sha256').update(source).digest('hex'), hash);
    const archived = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
    if (existsSync(archived)) assert.deepEqual(readFileSync(archived), source);
    else writeFileSync(archived, source, { flag: 'wx' });
  }
}
copyFileSync(resolve(input, 'capture-window-device-session-closure.json'), resolve(target, 'device-session-closure.json'), 1);
copyFileSync(resolve(input, 'capture-window-sdk-bytecode.txt'), resolve(target, 'sdk-window-capture-1.10.6.txt'), 1);
copyFileSync(resolve(input, 'capture-window-sdk-resolution.txt'), resolve(target, 'sdk-resolution.txt'), 1);
for (const mode of ['baseline', 'candidate']) copyFileSync(resolve(input, `capture-window-${mode}-build.txt`), resolve(target, `${mode}-build.txt`), 1);
const remote = resolve(input, '1f42138-remote-ride-stop'), ci = resolve(target, 'previous-ci'); mkdirSync(ci);
const local = resolve(remote, 'local-ui-evidence/8d57cd595875a0069d8d329b223d12b4');
for (const file of ['LocalRemoteRideStopFlowTest-instrumentation.txt', 'adb-pull-remote-ride-stop.json',
  'adb-sync-remote-ride-stop-diagnostics.json']) copyFileSync(resolve(local, file), resolve(ci, file), 1);
for (const file of ['disposable-device-restore.json', 'remote-ride-stop-suite-status.json'])
  copyFileSync(resolve(remote, 'focused-safety-ui/remote-ride-stop', file), resolve(ci, file), 1);
const gh = args => execFileSync('gh', args, { encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
writeFileSync(resolve(ci, 'native-run.json'), gh(['run', 'view', '41067565809', '--repo', 'MohamedRed/Sports-Green-Moove', '--json', 'status,conclusion,headSha,jobs']), { flag: 'wx' });
writeFileSync(resolve(ci, 'artifact.json'), gh(['api', 'repos/MohamedRed/Sports-Green-Moove/actions/artifacts/12983067931']), { flag: 'wx' });
const hashes = {};
for (const file of readdirSync(target, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())) {
  const relative = resolve(file.parentPath, file.name).slice(target.length + 1);
  hashes[relative] = createHash('sha256').update(readFileSync(resolve(target, relative))).digest('hex');
}
writeFileSync(resolve(target, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(validateCaptureWindowEvidence(root)));
