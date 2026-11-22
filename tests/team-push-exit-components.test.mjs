import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {sessionExitComponentsFolder as folder, validateSessionExitComponents} from '../partner-portal/session-exit-components-validation.mjs';
import {content} from '../partner-portal/content.mjs';

test('the corrected orientation passes three actual component cases without changing the old phone result or full-gate failure', () => {
  const result = validateSessionExitComponents(process.cwd()); assert.equal(result.correctedOrientationCallExecuted, true);
  const flow = content.flows.find(row => row.id === 'signout'); assert.equal(flow.checkedAt, '2026-10-13');
  assert.equal(flow.exitComponents.source, folder + 'review.json');
  const blocker = content.blockers.find(row => row.id === 'native-evidence-copy');
  assert.equal(blocker.exitLayoutRecheck.source, folder + 'README.md');
  assert.equal(blocker.latestSource, 'docs/release/evidence/native-team-push-exit-gate-a2e3e19-2026-11-01/README.md');
  const update = content.updates.find(row => row.source === folder + 'README.md'); assert(update);
  assert.match(update.text, /en simulation/); assert.match(update.text, /reste à régler/);
  assert.doesNotMatch(update.title + update.text, /\b(?:firebase|browserstack|SDK|API|FCM|CI)\b/i);
  const manifest = JSON.parse(readFileSync('docs/release/evidence-manifest.json'));
  assert.equal(manifest.operationalUserFlowEvidence.items.find(row => row.id === 'team_push_signout_cleanup').status, 'pending');
});
for (const [file, key, value] of [
  ['review.json', 'fullGatePassed', true], ['review.json', 'physicalDevice', true], ['review.json', 'pushDeliveryVerified', true],
  ['review.json', 'fullAppSystemInsetsVerified', true], ['review.json', 'releaseAccepted', true],
  ['review.json', 'realMessagingSdkCalls', 1], ['copy.json', 'completed', false], ['restore.json', 'verified', false],
]) test(`rehashed component proof rejects ${file} ${key}=${value}`, t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-exit-components-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(folder, temp, {recursive: true}); const path = resolve(temp, file), valueBefore = JSON.parse(readFileSync(path)); valueBefore[key] = value;
  writeFileSync(path, JSON.stringify(valueBefore)); const index = resolve(temp, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(index));
  hashes[file] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(index, JSON.stringify(hashes));
  assert.throws(() => validateSessionExitComponents(process.cwd(), temp));
});
