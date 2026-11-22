import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { content } from '../partner-portal/content.mjs';
import { validateNativeCaptureRecheck } from '../scripts/qa/native-capture-recheck-evidence.mjs';

const record = content.nativeCaptureRecheck;
test('completed 36-group replay and eleven focused lanes cannot hide the ordinary PixelCopy failure', () => {
  const report = validateNativeCaptureRecheck(process.cwd(), record);
  assert.equal(report.localReplayCompleted, true); assert.equal(report.fullCiPassed, false);
  assert.equal(report.rootCauseEstablished, false); assert.equal(report.releaseComplete, false);
});
for (const [file, mutate] of [
  ['summary.json', value => value.fullCiPassed = true],
  ['summary.json', value => value.rootCauseEstablished = true],
  ['summary.json', value => value.localReplayCompleted = false],
  ['native-run.json', value => value.conclusion = 'success'],
  ['replay/results.json', value => value.steps[0].status = 'failed'],
  ['replay/adb-pull-trip-consent-recovery.json', value => value.completed = false],
  ['disposable-store-restore.json', value => value.installAdmin.originalPolicyRestored = false],
]) test('rejects a rehashed unsupported native state: ' + file + ' ' + mutate, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-native-capture-evidence-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const base = resolve(root, dirname(record.source)); cpSync(dirname(resolve(process.cwd(), record.source)), base, {recursive: true});
  const path = resolve(base, file), value = JSON.parse(readFileSync(path)); mutate(value); writeFileSync(path, JSON.stringify(value));
  const manifest = resolve(base, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifest));
  hashes[file] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(manifest, JSON.stringify(hashes));
  assert.throws(() => validateNativeCaptureRecheck(root, record));
});
