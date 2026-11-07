import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {nativeCopyFollowupFolder, validateNativeCopyFollowup} from '../scripts/qa/native-copy-followup-evidence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
test('latest failed primary copy stays distinct from passing instrumentation and cleanup copy', () => {
  assert.deepEqual(validateNativeCopyFollowup(root), {fullNativeGateAccepted: false,
    networkInstrumentationPassed: true, primaryCopyAccepted: false});
  assert(content.updates.some(row => row.flow === 'messages' && row.source === nativeCopyFollowupFolder + 'README.md'));
  assert(content.blockers.find(row => row.id === 'native-evidence-copy').latestSource);
  assert(content.blockers.find(row => row.id === 'chat-send-stability').latestSource);
});
test('both workflows run the added phone and copy checks separately from preserved workload steps', () => {
  for (const name of ['native-ci', 'web-integration-smoke']) {
    const workflow = parseDocument(readFileSync(resolve(root, '.github/workflows', name + '.yml'), 'utf8')).toJSON();
    const matches = Object.values(workflow.jobs).flatMap(job => job.steps ?? [])
      .filter(step => step.name === 'Validate physical calendar retry and latest native copy evidence');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].run, 'node --test tests/search-departure-phone.test.mjs tests/search-departure-ci.test.mjs');
    assert.equal(matches[0].if, undefined); assert.equal(matches[0]['continue-on-error'], undefined);
  }
});
for (const key of ['fullNativeGateAccepted', 'offlineChatSequenceAccepted', 'primaryCopyAccepted',
  'failureCleanupReplacesPrimary', 'storedChatRecordsVerified', 'copyFailureRootCauseEstablished', 'physicalPhoneAccepted', 'releaseAccepted'])
  test('a recomputed manifest cannot promote the failed copy to ' + key, () => {
    const temp = mkdtempSync(resolve(tmpdir(), 'sgm-copy-followup-'));
    const folder = resolve(temp, nativeCopyFollowupFolder);
    try {
      cpSync(resolve(root, nativeCopyFollowupFolder), folder, {recursive: true});
      validateNativeCopyFollowup(temp);
      const review = JSON.parse(readFileSync(resolve(folder, 'review.json'))); review[key] = true;
      const bytes = JSON.stringify(review); writeFileSync(resolve(folder, 'review.json'), bytes);
      const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
      hashes['review.json'] = createHash('sha256').update(bytes).digest('hex');
      writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
      assert.throws(() => validateNativeCopyFollowup(temp), new RegExp(key));
    } finally {rmSync(temp, {recursive: true, force: true});}
  });
