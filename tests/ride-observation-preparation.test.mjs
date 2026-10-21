import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

test('ride-observation preparation failure cannot count as executed app or tracking evidence', () => {
  const base = new URL('../docs/release/evidence/ride-observation-preparation-2026-10-21/', import.meta.url);
  const bytes = file => readFileSync(new URL(file, base));
  const job = JSON.parse(bytes('job.json')), log = gunzipSync(bytes('job-log.txt.gz')).toString();
  assert.equal(job.id, 119303030364); assert.equal(job.run_id, 39623570942);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.name, 'Android focused safety UI tests / Isolated ride-observation');
  assert.equal(job.steps.find(step => step.name === 'Run one isolated safety flow on its own phone').conclusion, 'failure');
  assert.match(log, /shell settings put global transition_animation_scale 0\.0/);
  assert.match(log, /The process '.*\/adb' failed with exit code 255/);
  assert.match(log, /No artifacts will be uploaded/);
  assert(!log.includes('[command]/usr/bin/sh -c bash scripts/run-focused-android-ui.sh ride-observation'));
  assert(!log.includes('INSTRUMENTATION_CODE:')); assert(!log.includes('OK (1 test)'));
  assert.match(bytes('README.md').toString(), /exact reason for the ADB command failure is not established/);
  for (const [file, hash] of Object.entries(JSON.parse(bytes('artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), hash);
});
