import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateTeamReadPhone } from '../scripts/qa/team-read-phone-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';
import { detail } from '../partner-portal/src/render.js';

const source = 'docs/release/evidence/team-read-phone-2026-10-21/results.json';
test('eight reviewed phone stages retain their independent reads and bounded verification scope', () => {
  const run = validateTeamReadPhone(process.cwd(), source), flow = content.flows.find(item => item.id === 'team-conversation');
  assert.equal(flow.readPhone.source, source); assert.equal(flow.status, 'partial');
  assert.equal(flow.latestEvidence, 'phone'); assert.match(detail(flow), /Essai sur téléphone du/);
  assert.equal(run.nativePngExportObtained, false); assert.equal(run.twoPhoneFlowVerified, false);
  assert.deepEqual(flow.tour.filter(step => step.image.startsWith('team-read-phone-')).map(step => step.image),
    Object.keys(run.publishedCaptures));
  for (const [id, file] of Object.entries(run.publishedCaptures)) {
    assert.equal(captures[id], source.replace('results.json', file));
    assert.match(flow.images.find(image => image.file === id).alt, /essai sur téléphone du 21 octobre/);
  }
  const historyPrefixes = ['team-read-verified-', 'team-draft-', 'team-access-', 'team-chat-'];
  const historical = value => historyPrefixes.some(prefix => value.startsWith(prefix));
  assert.equal(flow.images.filter(image => historical(image.file)).length, 42);
  assert.equal(flow.tour.filter(step => historical(step.image)).length, 19);
  const smoke = readFileSync('.github/workflows/web-integration-smoke.yml', 'utf8');
  assert(smoke.includes('tests/team-chat-read-phone-evidence.test.mjs'));
  const build = readFileSync('scripts/build-partner-portal.mjs', 'utf8'); assert(build.includes('flow.readPhone'));
});
for (const [file, mutate] of [
  ...['nativePngExportObtained', 'twoPhoneFlowVerified', 'notificationsVerified', 'trackingVerified',
    'paymentExercised', 'productionWrites', 'releaseEvidenceAccepted', 'fullCiVerified', 'videoCaptured']
    .map(key => ['results.json', value => value[key] = true]),
  ['results.json', value => value.captureMethod = 'original-native-device-png-export'],
  ['results.json', value => value.captureRectangle.width = 251],
  ['session-results.json', value => value.completed = false],
  ['session-results.json', value => value.physicalUiProvenByThisReport = true],
  ['parent-returned.json', value => value.state.receipts.pop()],
  ['driver-unread.json', value => value.state.counts['sgm-qa-driver'] = 0],
  ['parent-read.json', value => value.isolation.originalClaimsUnchanged = false],
  ['local-cleanup.json', value => value.ownedRuntimeRemoved = false],
  ['local-cleanup.json', value => value.devicePolicyChanged = true],
  ['connection-policy.json', value => value.settings.forceLocal = true],
]) test(`rejects contradictory phone proof ${file}: ${mutate}`, () => {
  assert.throws(() => validateTeamReadPhone(process.cwd(), source, path => {
    const bytes = readFileSync(path); if (!path.endsWith('/' + file)) return bytes;
    const value = JSON.parse(bytes); mutate(value); return Buffer.from(JSON.stringify(value));
  }));
});
for (const file of ['parent-returned-device.jpg', 'parent-read-context.jpg', 'closed-ui.txt', 'uninstall-ui.txt'])
  test(`rejects changed original or published ${file}`, () => {
    assert.throws(() => validateTeamReadPhone(process.cwd(), source,
      path => path.endsWith('/' + file) ? Buffer.from('changed evidence') : readFileSync(path)));
  });
