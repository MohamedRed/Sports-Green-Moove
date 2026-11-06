import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {network959Folder, network959Identity, validateNetwork959Evidence} from '../scripts/qa/native-network-959-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(resolve(root, path), 'utf8');
test('the exact same-source isolated success and full-matrix prerequisite failure remain distinct', () => {
  const report = validateNetwork959Evidence(root);
  assert.equal(report.focusedRecoveryAccepted, true); assert.equal(report.wholeNativeGateAccepted, false);
  assert.equal(report.dnsRepaired, false); assert.equal(report.providerReadinessAccepted, false);
});
for (const [file, change] of [
  ['summary.json', row => row.wholeNativeGateAccepted = true], ['summary.json', row => row.dnsRepaired = true],
  ['summary.json', row => row.underlyingDnsCauseConfirmed = true], ['summary.json', row => row.physicalDeviceAccepted = true],
  ['main-ui.json', row => row.completed = true], ['main-ui.json', row => row.preparationFailure.hasDefaultDataSubscription = false],
  ['main-ui.json', row => row.preparationFailure.capabilityObservation.available[0].validated = true],
  ['main-archive.json', row => row.members[0].destination = '../outside'], ['main-archive.json', row => row.members.pop()],
  ['callback-health.json', row => row.observations[0].httpStatus = 503],
]) test('rehashed paired proof cannot promote or rewrite ' + change.toString(), t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-network-959-evidence-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, network959Folder); cpSync(resolve(root, network959Folder), base, {recursive: true});
  symlinkSync(resolve(root, network959Identity.folder), resolve(temp, network959Identity.folder));
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temp, 'docs/release/evidence/source-archive'));
  const path = resolve(base, file), data = JSON.parse(readFileSync(path)); change(data); writeFileSync(path, JSON.stringify(data));
  const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json'))); hashes[file] = sha(readFileSync(path));
  writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes)); assert.throws(() => validateNetwork959Evidence(temp));
});
test('the full-matrix candidate adds only the existing passive prerequisite, preserving every original command', () => {
  const source = JSON.parse(read(network959Folder + 'source-sha256.json'));
  const path = 'scripts/run-android-ui-tests-and-collect-screenshots.sh';
  const before = read('docs/release/evidence/source-archive/' + source.baseline[path] + '.txt'), current = read(path);
  const added = 'node "$repo_root/scripts/qa/wait-disposable-wifi.mjs" "$output_dir/network-readiness" || exit 1\n';
  assert.equal(current.split(added).length, 2); assert.equal(current.replace(added, ''), before);
  assert(current.indexOf('wait-disposable-wifi.mjs') < current.indexOf('configure-continuous-disposable.mjs'));
  assert(current.indexOf('observe-network-bootstrap.mjs') < current.indexOf('wait-disposable-wifi.mjs'));
  const workflowPath = '.github/workflows/native-ci.yml';
  const original = parseDocument(read('docs/release/evidence/source-archive/' + source.baseline[workflowPath] + '.txt')).toJSON();
  const workflow = parseDocument(read(workflowPath)).toJSON(); assert.deepEqual(workflow.jobs, original.jobs);
  assert.equal(workflow.jobs['android-native-ui']['timeout-minutes'], 50);
});
test('the public note describes success and the separate incomplete run without technical names or new media', () => {
  const note = content.updates.find(row => row.source === network959Folder + 'README.md'); assert(note);
  assert.match(note.text, /sans doublon/); assert.match(note.text, /complet.*avant la coupure/);
  assert.doesNotMatch(note.title + note.text, /Firebase|BrowserStack|Android|SDK|DNS|CI\b/);
  assert.equal(content.flows.length, 34);
});
