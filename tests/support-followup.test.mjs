import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateSupportFollowup, validateSupportFollowupReport } from '../scripts/qa/support-followup-evidence.mjs';
const root = resolve(import.meta.dirname, '..'), source = 'docs/release/evidence/support-followup-2026-10-22/results.json';
const original = JSON.parse(readFileSync(resolve(root, source)));
test('retained local support service/browser proof is complete and checksum bound', () => validateSupportFollowup(root, source));
test('local support checks never become native, physical, push or production proof', () => {
  for (const field of ['nativeUi', 'physicalDevice', 'pushDeliveryVerified', 'productionWrites']) {
    const report = structuredClone(original); report[field] = true; assert.throws(() => validateSupportFollowupReport(report));
  }
});
test('missing, duplicate or failed support scenarios are refused', () => {
  for (const action of [report => report.checks.pop(), report => { report.checks[1] = report.checks[0]; },
    report => { report.checks[0].status = 'failed'; }, report => { report.browser.scope = 'phone'; },
    report => { report.browser.externalRequests = 1; }]) {
    const report = structuredClone(original); action(report); assert.throws(() => validateSupportFollowupReport(report));
  }
});
test('requester native gateways use only owner-scoped callables and never raw report reads', () => {
  const android = readFileSync(resolve(root, 'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidSupportGateway.kt'), 'utf8');
  const swift = readFileSync(resolve(root, 'ios/Sources/SportsGreenMooveApp/FirebaseSupportGateway.swift'), 'utf8');
  for (const text of [android, swift]) {
    assert(text.includes('listMySupportReports')); assert(text.includes('getMySupportReport'));
    assert.doesNotMatch(text, /collection\(|reviewNote|reviewEvents|authorUid|reporterUserId/);
    assert(text.includes('currentUser?.uid'));
  }
});
