import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {teamPushNativeGateFolder as folder, validateTeamPushNativeGate} from '../scripts/qa/team-push-native-gate-evidence.mjs';
import {nativeNetworkPreparationFolder, validateTeamPushNetworkGate} from '../scripts/qa/team-push-network-gate-evidence.mjs';
import {exitGateFolder} from '../partner-portal/team-push-exit-gate-validation.mjs';
import {content} from '../partner-portal/content.mjs';

test('the older capture failure is retained separately from the latest failed network preparation', () => {
  const result = validateTeamPushNativeGate(process.cwd()); assert.equal(result.fullGatePassed, false);
  for (const id of ['native-evidence-copy', 'chat-send-stability']) {
    const blocker = content.blockers.find(row => row.id === id); assert.equal(blocker.pixelCopyHistory.source, folder + 'README.md');
    assert.equal(blocker.latestSource, exitGateFolder + 'README.md');
    assert.equal(blocker.networkPreparationHistory.source, nativeNetworkPreparationFolder + 'README.md');
    assert.equal(blocker.latestPassingSource, 'docs/release/evidence/notification-gate-d476cce-2026-11-01/README.md');
  }
  const update = content.updates.find(row => row.source === folder + 'README.md'); assert(update);
  assert.match(update.text, /cause reste à confirmer/); assert.doesNotMatch(update.title + update.text, /firebase|browserstack|PixelCopy|SDK|CI|GPU/i);
});
test('the newer main pass cannot accept chat retry because its isolated network preparation failed', () => {
  const result = validateTeamPushNetworkGate(process.cwd()); assert.equal(result.chatRetryOutcomeReached, false);
  const update = content.updates.find(row => row.source === nativeNetworkPreparationFolder + 'README.md'); assert(update);
  assert.match(update.text, /préparation du réseau/); assert.doesNotMatch(update.title + update.text, /\b(?:firebase|browserstack|SDK|CI|GPU)\b/i);
});
for (const key of ['fullGatePassed', 'rootCauseConfirmed', 'physicalDevice', 'runtimeCallbacksExecuted', 'pushDeliveryVerified', 'releaseAccepted', 'rawArchiveDigestIndependentlyMatched'])
  test('rehashed failed gate cannot promote ' + key, t => {
    const temp = mkdtempSync(resolve(tmpdir(), 'sgm-push-native-gate-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
    cpSync(resolve(folder), temp, {recursive: true}); const path = resolve(temp, 'review.json'), row = JSON.parse(readFileSync(path)); row[key] = true;
    writeFileSync(path, JSON.stringify(row)); const manifestPath = resolve(temp, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifestPath));
    hashes['review.json'] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(manifestPath, JSON.stringify(hashes));
    assert.throws(() => validateTeamPushNativeGate(process.cwd(), temp));
  });
