import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateTeamAuthorityPhone } from '../scripts/qa/team-authority-phone-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const source = 'docs/release/evidence/team-authority-phone-2026-10-21/results.json';
test('five phone authority stages retain exact checkpoints, original captures and bounded scope', () => {
  const run = validateTeamAuthorityPhone(process.cwd(), source), flow = content.flows.find(item => item.id === 'team-conversation');
  assert.equal(flow.authorityPhone.source, source); assert.equal(flow.status, 'partial');
  assert.deepEqual(flow.tour.filter(step => step.image.startsWith('team-authority-phone-')).map(step => step.image),
    Object.keys(run.publishedCaptures));
  for (const [id, file] of Object.entries(run.publishedCaptures)) {
    assert.equal(captures[id], source.replace('results.json', file));
    assert.match(flow.images.find(image => image.file === id).alt, /essai sur téléphone du 21 octobre/);
  }
  const blocker = content.blockers.find(item => item.id === 'group-conversation');
  assert.equal(blocker.source, flow.source); assert.match(blocker.next, /notifications.*échanges entre téléphones/);
  assert(readFileSync('scripts/build-partner-portal.mjs', 'utf8').includes('flow.authorityPhone'));
  const smoke = readFileSync('.github/workflows/web-integration-smoke.yml', 'utf8');
  assert.equal(smoke.split('"tests/team-chat-authority-phone-evidence.test.mjs"').length - 1, 2);
  assert.match(smoke, /run: node --test[^\n]*tests\/team-chat-authority-phone-evidence.test.mjs/);
});
for (const [file, mutate] of [
  ...['managerUiProven', 'twoPhoneFlowVerified', 'notificationsVerified', 'trackingVerified', 'paymentExercised',
    'productionWrites', 'releaseEvidenceAccepted', 'fullCiVerified', 'nativePngExportObtained', 'videoCaptured']
    .map(key => ['results.json', value => value[key] = true]),
  ['results.json', value => value.captureRectangle.width = 251],
  ['session-results.json', value => value.completed = false],
  ['session-results.json', value => value.phoneUiProven = true],
  ['revoked.json', value => value.state.parentDenied = false],
  ['renewed.json', value => value.state.parentMessageIds.push('old-history')],
  ['replied.json', value => value.state.entries[3].senderUserId = 'foreign-parent'],
  ['initial.json', value => value.isolation.originalClaimsUnchanged = false],
  ['connection-policy.json', value => value.settings.forceLocal = true],
  ['local-cleanup.json', value => value.ownedRuntimeRemoved = false],
  ['local-cleanup.json', value => value.devicePolicyChanged = true],
]) test(`rejects unsupported authority evidence ${file}: ${mutate}`, () => {
  assert.throws(() => validateTeamAuthorityPhone(process.cwd(), source, path => {
    const bytes = readFileSync(path); if (!path.endsWith('/' + file)) return bytes;
    const value = JSON.parse(bytes); mutate(value); return Buffer.from(JSON.stringify(value));
  }));
});
for (const file of ['initial-context.jpg', 'renewed-device.jpg', 'uninstalled-ui.txt', 'closed-ui.txt'])
  test(`rejects altered original evidence ${file}`, () => {
    assert.throws(() => validateTeamAuthorityPhone(process.cwd(), source,
      path => path.endsWith('/' + file) ? Buffer.from('changed') : readFileSync(path)));
  });
