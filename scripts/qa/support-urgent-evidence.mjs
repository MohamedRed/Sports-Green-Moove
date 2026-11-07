import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateUrgentSupportEvidence(root, source) {
  const base = dirname(resolve(root, source)), json = name => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
  const services = json('services.json'), browser = json('browser.json'), saved = json('saved-state.json'), cleanup = json('cleanup.json');
  assert.equal(services.scope, 'local-support-urgent-services-with-explicit-loopback-mail-provider-not-real-inbox-delivery');
  assert.equal(services.projectId, 'demo-sgm-local-qa'); assert.equal(saved.projectId, services.projectId);
  assert.equal(services.completed, true); assert.equal(services.checks.length, 11);
  assert.equal(new Set(services.checks.map(row => row.id)).size, 11);
  for (const id of ['concurrent-workers-cannot-send-during-an-active-lease',
    'lost-provider-acknowledgement-reuses-one-mail-and-the-original-recipient',
    'parent-and-club-manager-cannot-read-write-or-retry-the-mail-operation'])
    assert(services.checks.some(row => row.id === id));
  assert(services.checks.every(row => row.status === 'passed')); assert.equal(services.simulatedEmails, 2);
  assert.equal(services.handlerRequests.length, 3); assert.equal(services.protectedRecordCount, 19);
  assert.equal(browser.scope, 'actual-isolated-management-browser-not-native-phone-or-real-email');
  assert.equal(browser.checks.length, 6); assert(browser.checks.every(row => row.status === 'passed'));
  assert.equal(new Set(browser.checks.map(row => row.id)).size, 6);
  assert.deepEqual(browser.viewportChecks.map(row => row.width), [1440, 768, 390, 320]);
  for (const row of browser.viewportChecks) {
    assert.equal(row.pageWidth, row.viewport); assert.equal(row.urgentRows, 1); assert.equal(row.ordinaryRows, 50);
    assert.equal(row.configurationVisible, true); assert(row.tableWidth <= row.sectionWidth);
  }
  assert.equal(saved.protectedRecordCount, 158); assert.equal(saved.allBaselineRecordsUnchanged, true);
  assert.equal(saved.status, 'closed'); assert.equal(saved.emailStatus, 'needs_configuration');
  assert.equal(saved.providerAttempts, 0); assert.equal(saved.urgentOutsideOrdinaryWindow, true);
  for (const row of [services, saved]) for (const key of ['productionWrites', 'physicalDevice', 'realEmailSent']) assert.equal(row[key], false);
  for (const key of ['realEmailSent', 'productionDeployed', 'physicalDevice']) assert.equal(browser[key], false);
  for (const key of ['browserSignedOut', 'ownedTabClosed', 'viewportReset', 'fixtureCredentialFileRemoved']) assert.equal(cleanup[key], true);
  assert.deepEqual(cleanup.ownedPortsClosed, [5001,8080,9000,9099,5191]);
  assert.equal(cleanup.ownedUiSupervisorExit, 130); assert.equal(cleanup.ownedPreviewExit, 130);
  assert.equal(services.testedAt.slice(0, 10), '2026-10-23'); assert.equal(browser.testedAt.slice(0, 10), '2026-10-23');
  assertEvidenceBundleChecksums(base); return { checkedAt: '2026-10-23' };
}
