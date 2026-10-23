import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { content, captures } from '../partner-portal/content.mjs';
import { validateNotificationSettingsPhone } from '../scripts/qa/notification-settings-phone-evidence.mjs';

const flow = content.flows.find(row => row.id === 'notification-settings');
test('actual phone permission changes remain distinct from push delivery and compiled native cases', () => {
  const report = validateNotificationSettingsPhone(process.cwd(), flow);
  assert.equal(report.actualPhonePermissionFlowPassed, true); assert.equal(report.pushDeliveryAccepted, false);
  assert.equal(report.newNativeTestsExecuted, false); assert.equal(flow.images.length, 6);
  for (const image of flow.images) assert(captures[image.file].includes('/captures/'));
  assert(!Object.values(captures).some(file => /notification-settings-phone.*(?:phone\/|validation\/|source\/)/.test(file)));
  const news = content.updates.find(row => row.flow === flow.id);
  assert.match(news.text, /envoi des alertes au téléphone reste à ajouter/);
  const permissionNews = content.updates.find(row => row.source === flow.source);
  assert.match(permissionNews.text, /réception des alertes reste à tester/);
  assert.match(content.blockers.find(row => row.id === 'settings').text, /ville et les frais restent à vérifier/);
});
for (const [file, key, value] of [
  ['summary.json', 'pushDeliveryAccepted', true], ['summary.json', 'newNativeTestsExecuted', true],
  ['summary.json', 'productionWrites', true], ['summary.json', 'processSurvivalAccepted', true],
  ['summary.json', 'iosAccepted', true], ['summary.json', 'releaseComplete', true],
  ['cleanup.json', 'notificationAllowedFinally', true], ['phone/session-results.json', 'completed', false],
]) test('reject unproven notification claim: ' + file + '/' + key, t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-notification-evidence-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const base = dirname(flow.notificationPermissionPhone.source); cpSync(base, resolve(root, base), {recursive: true});
  const path = resolve(root, base, file), row = JSON.parse(readFileSync(path)); row[key] = value; writeFileSync(path, JSON.stringify(row));
  assert.throws(() => validateNotificationSettingsPhone(root, flow));
});
test('notification state, integration tests and reviewed phone evidence are wired in smoke', () => {
  const workflow = readFileSync('.github/workflows/web-integration-smoke.yml', 'utf8');
  for (const file of ['tests/notification-settings-contract.test.mjs', 'tests/notification-settings-phone-evidence.test.mjs']) {
    assert.equal(workflow.split('"' + file + '"').length - 1, 2);
    assert(workflow.includes(file));
  }
  assert(workflow.includes('node --test tests/notification-settings-contract.test.mjs tests/notification-settings-phone-evidence.test.mjs'));
});
