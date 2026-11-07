import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {content} from '../partner-portal/content.mjs';
import {trackingAttemptCaptures, trackingAttemptTour} from '../partner-portal/tracking-phone-attempt.mjs';
import {trackingClockTour} from '../partner-portal/tracking-clock-replay.mjs';
import {validateTrackingPhoneAttempt} from '../scripts/qa/tracking-phone-retained-evidence.mjs';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';

const root = resolve(import.meta.dirname, '..');
test('all retained GPS and native failure artifacts are included in a fresh checkout', () => {
  for (const folder of ['tracking-phone-clock-2026-10-25', 'native-checks-899e969-2026-10-25']) {
    const directory = 'docs/release/evidence/' + folder;
    const hashes = JSON.parse(readFileSync(resolve(root, directory, 'artifact-sha256.json')));
    const tracked = new Set(execFileSync('git', ['ls-files', '-z', '--', directory], {
      cwd: root, encoding: 'utf8',
    }).split('\0').filter(Boolean));
    for (const file of ['artifact-sha256.json', ...Object.keys(hashes)])
      assert(tracked.has(directory + '/' + file), 'Missing committed evidence: ' + directory + '/' + file);
  }
});
test('the incomplete phone run cannot promote movement, background, child or release acceptance', () => {
  const flow = content.flows.find(row => row.id === 'tracking');
  const run = validateTrackingPhoneAttempt(root, flow.trackingPhoneAttempt.source);
  assert.equal(run.completed, false); assert.equal(flow.status, 'partial');
  assert.equal(flow.checkedAt, '2026-10-25'); assert.equal(flow.latestEvidence, 'phone');
  assert.equal(flow.ui, undefined); assert.equal(flow.phone, undefined);
  assert.equal(flow.tour.length, 3); assert.deepEqual(flow.tour, trackingClockTour);
  assert.equal(trackingAttemptTour.length, 3, 'Original negative tour remains retained separately');
  for (const step of flow.tour) assert(flow.images.some(image => image.file === step.image));
  assert.match(flow.remaining, /vrai déplacement/); assert.match(flow.remaining, /compte enfant/);
});
test('the public images remain original-sized browser JPEGs, not invented native exports', () => {
  for (const file of Object.values(trackingAttemptCaptures)) {
    const {streams: [stream]} = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
      'stream=codec_name,width,height', '-of', 'json', resolve(root, file)], {encoding: 'utf8'}));
    assert.equal(stream.width, 253); assert.equal(stream.height, 564); assert.equal(stream.codec_name, 'mjpeg');
  }
});
test('the separate focused CI failure remains negative and its cleanup does not imply tracking success', () => {
  const folder = resolve(root, 'docs/release/evidence/native-checks-899e969-2026-10-25');
  assertEvidenceBundleChecksums(folder);
  const json = name => JSON.parse(readFileSync(resolve(folder, name)));
  const run = json('run.json'); assert.equal(run.headSha, '899e969c90d404cbbdc38976269e0fb1a517e281');
  assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(row => row.name === 'Android native UI tests').conclusion, 'success');
  assert.equal(run.jobs.find(row => row.name === 'Android focused safety UI tests / Isolated native-startup').conclusion, 'failure');
  const prefix = 'focused/focused-safety-ui/native-startup/';
  const restore = json(prefix + 'disposable-device-restore.json'); assert.equal(restore.verified, true);
  const host = json(prefix + 'host-shutdown/complete.json'); assert.equal(host.targetExitObserved, true); assert.equal(host.flowAccepted, false);
  assert.match(readFileSync(resolve(folder, 'failure.log'), 'utf8'), /ApiException: 20: The connection to Google Play services was lost/);
  assert.match(readFileSync(resolve(folder, 'previous-main-failure.log'), 'utf8'), /Local evidence collection failed during trip-change-parent-confirmation/);
});
