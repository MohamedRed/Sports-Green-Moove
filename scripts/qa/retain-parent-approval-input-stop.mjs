import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..');
const input = '/Users/mrr/.codex/tmp/sgm-child-parent-approval-phone.YnnqZS';
const folder = resolve(root, 'docs/release/evidence/parent-approval-input-stop-2026-11-02');
assert(!existsSync(folder));
for (const path of [input + '/phone-session.json', input + '/phone-session.json.signup',
  '/var/folders/b4/qz25f4f94vx9h0tv1d4xs3k80000gn/T/sgm-scoped-bs-2EjAT0']) assert(!existsSync(path));
const endpoints = await assertLocalEndpointsClosed([9099, 8080, 9000, 5001, 4185, 53348, 54794]);
mkdirSync(folder); const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (file, value) => writeFileSync(resolve(folder, file), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
for (const file of ['observations.json', 'connection-blocked-records.json', 'disposal.json'])
  copyFileSync(input + '/observations/' + file, resolve(folder, file), 1);
copyFileSync(input + '/phone-mismatch-session.jpg', resolve(folder, 'masked-mismatch-session.jpg'), 1);
copyFileSync(input + '/uninstall-observation.txt', resolve(folder, 'uninstall-observation.txt'), 1);
const observations = JSON.parse(readFileSync(resolve(folder, 'observations.json')));
const sources = {...observations.sourceFiles};
for (const file of ['scripts/qa/observe-invitation-connection-block.mjs', 'scripts/qa/private-fixture-input.mjs',
  'scripts/qa/private-credential-form.mjs', 'scripts/qa/start-scoped-browserstack-local.mjs',
  'scripts/qa/scoped-browserstack-local.mjs', 'scripts/qa/browserstack-local-policy.mjs']) {
  const bytes = execFileSync('git', ['show', '5d34c0f:' + file], {cwd: root}); sources[file] = sha(bytes);
}
for (const [file, expected] of Object.entries(sources)) {
  const bytes = execFileSync('git', ['show', '5d34c0f:' + file], {cwd: root}); assert.equal(sha(bytes), expected);
  const archive = resolve(root, 'docs/release/evidence/source-archive', expected + '.txt');
  if (existsSync(archive)) assert(readFileSync(archive).equals(bytes)); else writeFileSync(archive, bytes, {flag: 'wx'});
}
write('source-files.json', sources);
write('incident.json', {scope: 'stopped-temporary-local-credential-input-not-an-application-or-parent-approval-result',
  observedOn: '2026-11-02', sourceCommit: observations.applicationHead, runId: observations.runId,
  wrongDestinationObserved: 'phone-browser-address-bar', sensitiveInputKind: 'temporary-local-fixture-password',
  externalAutocompleteTransmission: 'possible-not-independently-measured', sensitiveToolOutputOccurred: true,
  sensitiveFrameRetainedInRepository: false, sensitiveValueRetainedInReport: false, realCredentialAffected: false,
  exactRoutingCauseProven: false, unsafeCredentialReused: false, temporaryCredentialInvalidatedByDatasetDisposal: true,
  childAccountCreated: false, parentApprovalProven: false, correctedPhoneRetryExecuted: false, releaseComplete: false});
write('phone-and-helper-disposal.json', {sessionStopped: true, uninstallAcknowledged: true,
  independentPackageAbsenceProven: false, helperExitCode: 130, helperGroupExitVerified: true,
  helperDirectoryAbsent: true, privateInputsAbsent: true, hostClipboardRestored: true, privatePasswordCleared: true,
  devicePolicyChanged: false, hostPermissionsChanged: false, endpoints});
const hashes = Object.fromEntries(readdirSync(folder).map(file => [file, sha(readFileSync(resolve(folder, file)))]));
write('artifact-sha256.json', hashes);
console.log('Retained the interrupted preparation and verified disposal, without sensitive input or new public media.');
