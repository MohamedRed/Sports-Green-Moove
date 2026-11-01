import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {teamPushNativeGateFolder as folder, validateTeamPushNativeGate} from '../scripts/qa/team-push-native-gate-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

test('the latest complete inventory stays failed while one private-storage case and eleven focused lanes pass', () => {
  const result = validateTeamPushNativeGate(process.cwd()); assert.equal(result.fullGatePassed, false);
  for (const id of ['native-evidence-copy', 'chat-send-stability']) {
    const blocker = content.blockers.find(row => row.id === id); assert.equal(blocker.latestSource, folder + 'README.md');
    assert.equal(blocker.latestPassingSource, 'docs/release/evidence/notification-gate-d476cce-2026-11-01/README.md');
    assert.match(blocker.text, /deux captures|Deux captures/);
  }
  const update = content.updates.find(row => row.source === folder + 'README.md'); assert(update);
  assert.match(update.text, /cause reste à confirmer/); assert.doesNotMatch(update.title + update.text, /firebase|browserstack|PixelCopy|SDK|CI|GPU/i);
});
for (const key of ['fullGatePassed', 'rootCauseConfirmed', 'physicalDevice', 'runtimeCallbacksExecuted', 'pushDeliveryVerified', 'releaseAccepted', 'rawArchiveDigestIndependentlyMatched'])
  test('rehashed failed gate cannot promote ' + key, t => {
    const temp = mkdtempSync(resolve(tmpdir(), 'sgm-push-native-gate-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
    cpSync(resolve(folder), temp, {recursive: true}); const path = resolve(temp, 'review.json'), row = JSON.parse(readFileSync(path)); row[key] = true;
    writeFileSync(path, JSON.stringify(row)); const manifestPath = resolve(temp, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifestPath));
    hashes['review.json'] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(manifestPath, JSON.stringify(hashes));
    assert.throws(() => validateTeamPushNativeGate(process.cwd(), temp));
  });
