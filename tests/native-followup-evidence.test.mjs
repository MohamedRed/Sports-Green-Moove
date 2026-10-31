import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {nativeFollowup as identity, validateNativeFollowup} from '../scripts/qa/native-followup-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
import {validateNativeFollowupMain} from '../scripts/qa/native-followup-main-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
test('full native execution preserves its one failed ordinary capture beside forty passing integrated cases', () => {
  const result = validateNativeFollowupMain(root);
  assert.equal(result.nativeGatePassed, false); assert.equal(result.ordinary.failed, 1);
  assert.equal(result.replayCases, 40); assert.equal(result.primaryCopies, 17);
  const update = content.updates.find(row => row.flow === 'native-startup' && row.source === identity.folder + 'README.md');
  assert.equal(update.source, identity.folder + 'README.md'); assert.match(update.text, /reste en échec/);
});
for (const [file, mutate] of [
  ['native-run.json', r => r.conclusion = 'success'],
  ['ordinary-results.json', r => r.failed = 0],
  ['native-suite-status.json', r => r.ordinaryTests = 0],
  ['replay/results.json', r => r.steps[0].status = 'failed'],
  ['device-restoration.json', r => r.restoration.installAdmin.originalPolicyRestored = false],
]) test('full native evidence rejects rehashed ' + file + ' contradiction', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-main-followup-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, identity.folder, 'main'); cpSync(resolve(root, identity.folder, 'main'), base, {recursive: true});
  const archive = resolve(temp, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
  const path = resolve(base, file), value = JSON.parse(readFileSync(path)); mutate(value);
  const bytes = JSON.stringify(value); writeFileSync(path, bytes);
  const manifest = resolve(base, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifest));
  hashes[file] = createHash('sha256').update(bytes).digest('hex'); writeFileSync(manifest, JSON.stringify(hashes));
  assert.throws(() => validateNativeFollowupMain(temp));
});
test('independent team and network trials bind execution, stored messages, primary transfers and disposal', () => {
  const {team, network} = validateNativeFollowup(root);
  assert.equal(team.checks.length, 9); assert.equal(team.fixtureIsolation.committedMessages, 5);
  assert.equal(network.network.messageCount, 2); assert.equal(network.network.duplicateMessages, 0);
  assert.equal(team.notificationsVerified, false); assert.equal(team.fullProcessRestartProven, false);
});
for (const [area, file, mutate] of [
  ['team', 'team-conversation-results.json', r => r.fixtureIsolation.committedMessages++],
  ['team', 'team-conversation-results.json', r => r.fixtureIsolation.parentRevocationPersisted = false],
  ['team', 'team-conversation-device.json', r => r.checks.pop()],
  ['team', 'team-conversation-results.json', r => r.notificationsVerified = true],
  ['team', 'team-conversation-results.json', r => r.physicalDevice = true],
  ['team', 'team-conversation-results.json', r => r.unreadStateVerified = false],
  ['team', 'team-conversation-results.json', r => r.emulatorEndpoints.closed = false],
  ['team', 'adb-pull-team-conversation.json', r => r.completed = false],
  ['team', 'disposable-device-restore.json', r => r.restoration.installAdmin.authorizationRemoved = false],
  ['team', 'job.json', r => r.conclusion = 'failure'],
  ['team', 'artifact.json', r => r.workflow_run.head_sha = '0'.repeat(40)],
  ['network', 'chat-network-validation-before.json', r => r.runId = '0'.repeat(32)],
  ['network', 'chat-network-validation-after.json', r => r.flowCompleted = true],
  ['network', 'chat-network-validation-after.json', r => r.probeTargetsRetained = true],
  ['network', 'chat-network-recovery-results.json', r => r.network.duplicateMessages++],
]) test('rejects rehashed ' + area + '/' + file + ' contradiction', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-native-followup-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  const base = resolve(temp, identity.folder); cpSync(resolve(root, identity.folder), base, {recursive: true});
  const archive = resolve(temp, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
  const path = resolve(base, area, file), value = JSON.parse(readFileSync(path)); mutate(value);
  const bytes = JSON.stringify(value); writeFileSync(path, bytes);
  const manifest = resolve(base, area, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifest));
  hashes[file] = createHash('sha256').update(bytes).digest('hex'); writeFileSync(manifest, JSON.stringify(hashes));
  assert.throws(() => validateNativeFollowup(temp));
});
test('progress keeps physical media historical and independent passes separate from release acceptance', () => {
  const team = content.flows.find(row => row.id === 'team-conversation');
  assert.equal(team.status, 'partial'); assert.equal(team.checkedAt, '2026-10-21'); assert.equal(team.phone.checkedAt, '2026-10-21');
  assert.equal(team.nativeRecheck.checkedAt, identity.date);
  assert.equal(team.nativeRecheck.source, identity.folder + 'team/team-conversation-results.json');
  assert(team.images.every(image => image.alt.includes('21 octobre')));
  const update = content.updates.find(row => row.flow === 'team-conversation');
  assert.equal(update.source, identity.folder + 'README.md'); assert.match(update.text, /en local/);
  assert.doesNotMatch(update.text, /BrowserStack|Firebase|SDK|Android/);
  assert(content.updates.some(row => row.source === 'docs/release/evidence/chat-network-preparation-4714198/README.md'));
});
test('native, web and backend checks run the retained follow-up contracts', () => {
  for (const file of ['native-ci.yml', 'web-integration-smoke.yml', 'backend-ci.yml']) {
    const workflow = parseDocument(readFileSync(resolve(root, '.github/workflows', file), 'utf8')).toJSON();
    assert(Object.values(workflow.jobs).some(job => job.steps?.some(step => step.run?.includes('tests/native-followup-evidence.test.mjs'))), file);
  }
});
