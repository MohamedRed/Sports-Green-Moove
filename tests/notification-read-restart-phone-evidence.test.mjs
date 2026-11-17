import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { validateNotificationReadRestartPhone as validate } from '../scripts/qa/notification-read-restart-phone-evidence.mjs';
import { validateNotificationReadPhone } from '../scripts/qa/notification-read-phone-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const flow = content.flows.find(row => row.id === 'notification-settings'), record = flow.notificationReadRestartPhone;
test('measured physical notification restart remains separate from the historical account switch and production tracking', () => {
  const report = validate(process.cwd(), record);
  assert.equal(report.notificationProcessRestartPassed, true); assert.equal(report.productionTrackingRestartAccepted, false);
  assert.equal(flow.status, 'partial'); assert.match(flow.remaining, /hors de l’app.*iPhone/);
  assert.equal(validateNotificationReadPhone(process.cwd(), flow.notificationReadPhone).processDeathAccepted, false);
  for (const phase of report.publishedCaptures) {
    const id = 'notification-restart-phone-' + phase;
    assert.equal(captures[id], dirname(record.source) + '/captures/' + phase + '.jpg');
    assert(flow.images.some(image => image.file === id && image.alt.includes('23 octobre')));
  }
  assert(!Object.values(captures).some(path => /notification-read-restart-phone.*(?:process-|checkpoints|source|force-stop|signed-out|launcher-)/.test(path)));
});

for (const [name, file, mutate] of [
  ['push promotion', 'summary.json', r => r.pushDeliveryAccepted = true],
  ['tracking promotion', 'summary.json', r => r.productionTrackingRestartAccepted = true],
  ['release promotion', 'summary.json', r => r.releaseComplete = true],
  ['APK-byte promotion', 'summary.json', r => r.installedBytesIndependentlyVerified = true],
  ['same process', 'summary.json', r => r.pids.after = r.pids.before],
  ['unmeasured PID', 'summary.json', r => r.pids.before++],
  ['invented preparation cause', 'summary.json', r => r.preparationRestartCauseKnown = true],
  ['missing stopped interval', 'process-stopped.json', r => r.visibleOutput = 'No new PID measured'],
  ['wrong package', 'process-after.json', r => r.visibleOutput = r.visibleOutput.replaceAll('be.sportgreenmoove.app.local', 'another.app')],
  ['out-of-order stop', 'process-stopped.json', r => r.recordedAt = '2026-10-23T23:50:00.000Z'],
  ['changed first read', 'checkpoints/restarted.json', r => r.state.documents.notifications
    .find(row => row.id === r.fixture.selectedNoticeId).data.readAt._nanoseconds++],
  ['another alert read', 'checkpoints/restarted.json', r => r.state.documents.notifications
    .find(row => row.id === r.fixture.controlNoticeId).data.read = true],
  ['foreign account changed', 'checkpoints/stopped.json', r => r.state.claims[0].claims.role = 'admin'],
  ['observer promoted to process proof', 'checkpoints/session-results.json', r => r.nativeProcessIdsMeasured = true],
  ['missing observer checkpoint', 'checkpoints/session-results.json', r => r.checkpoints.pop()],
  ['missing archived sources', 'checkpoints/session-results.json', r => r.sourceFiles = {}],
  ['uninstall promotion', 'cleanup.json', r => r.appUninstallVerified = true],
  ['open backend', 'cleanup.json', r => r.endpoints.closed = false],
]) test('rejects ' + name + ' even with a refreshed file checksum', t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-notice-restart-proof-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const base = dirname(record.source), target = resolve(root, base); cpSync(base, target, { recursive: true });
  const path = resolve(target, file), value = JSON.parse(readFileSync(path)); mutate(value);
  const bytes = JSON.stringify(value); writeFileSync(path, bytes);
  const hashPath = resolve(target, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(hashPath));
  hashes[file] = createHash('sha256').update(bytes).digest('hex'); writeFileSync(hashPath, JSON.stringify(hashes));
  assert.throws(() => validate(root, record));
});

test('both service CI paths execute retained restart proof without changing physical tracking gates', () => {
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml'])
    assert(readFileSync('.github/workflows/' + name, 'utf8').includes('tests/notification-read-restart-phone-evidence.test.mjs'));
  const manifest = JSON.parse(readFileSync('docs/release/evidence-manifest.json'));
  assert(!JSON.stringify(manifest).includes(record.source));
});
