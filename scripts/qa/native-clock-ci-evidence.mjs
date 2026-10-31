import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {validateNativeClockStartupReport} from './native-clock-startup-evidence.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';

export function validateNativeClockCi(root, directory) {
  const base = resolve(root, directory); assertEvidenceBundleChecksums(base);
  const json = name => JSON.parse(readFileSync(resolve(base, name)));
  const run = json('run.json'), summary = json('summary.json');
  assert.equal(run.headSha, '30e1ebef42cbe40b427a82d97f31c662f0961f61');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const jobs = run.jobs;
  assert.equal(jobs.find(row => row.name === 'Android native UI tests').conclusion, 'failure');
  const aggregate = 'Android focused safety UI tests / Isolated safety flows';
  assert.equal(jobs.find(row => row.name === aggregate).conclusion, 'success');
  const focused = jobs.filter(row => row.name.startsWith('Android focused safety UI tests /') && row.name !== aggregate);
  assert.equal(focused.length, 10); assert(focused.every(row => row.conclusion === 'success'));
  assert.equal(summary.wholeRunAccepted, false); assert.equal(summary.rootCauseConfirmed, false);
  const prefix = 'startup/local-ui-evidence/78df80575e701c625a421b4891f50929/';
  const report = json(prefix + 'native-startup-results.json'); validateNativeClockStartupReport(report);
  const marker = json(prefix + 'local-native-startup-device.json');
  for (const [key, value] of Object.entries(marker)) assert.deepEqual(report[key], value);
  for (const [file, expected] of Object.entries(report.screenshots)) {
    const bytes = readFileSync(resolve(base, prefix, file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
  const transcript = readFileSync(resolve(base, prefix, 'LocalNativeTrackingStartupTest-instrumentation.txt'));
  assertInstrumentationPassed(transcript.toString(), 1);
  assert.equal(createHash('sha256').update(transcript).digest('hex'), report.transcriptSha256);
  assert.equal(json(prefix + 'adb-pull-native-startup.json').completed, true);
  for (const [file, hash] of Object.entries(report.sourceFiles)) {
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, 'source', hash + '.txt'))).digest('hex'), hash, file);
  }
  assert.equal(json('startup/focused-safety-ui/native-startup/disposable-device-restore.json').verified, true);
  assert.equal(json('startup/focused-safety-ui/native-startup/host-shutdown/complete.json').targetExitObserved, true);
  const primary = json('main/adb-pull-trip-change-inputs.json');
  assert.equal(primary.completed, false); assert.equal(primary.status, 1); assert.equal(primary.signal, null);
  assert.equal(json('main/disposable-store-restore.json').verified, true);
  assert.equal(json('main/host-shutdown.json').targetExitObserved, true);
  assert.match(readFileSync(resolve(base, 'main-failure.log.txt'), 'utf8'), /Local evidence collection failed during trip-change-inputs/);
  return summary;
}
