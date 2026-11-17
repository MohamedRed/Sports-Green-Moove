import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {posix, resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';

export const searchSelectionFolder = 'docs/release/evidence/ios-search-selection-2026-11-06/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function validateSearchSelectionEvidence(root) {
  const base = resolve(root, searchSelectionFolder), read = file => readFileSync(resolve(base, file), 'utf8');
  assertEvidenceBundleChecksums(base);
  const report = JSON.parse(read('summary.json'));
  assert.equal(report.checkedAt, '2026-11-06'); assert.equal(report.baselineCommit, '959e70b41abb039037f94e6eeec8402b597b5bff');
  assert.equal(report.scope, 'controlled-search-selection-order-and-local-native-logic-not-screen-diagnosis');
  for (const [key, value] of Object.entries({baselineReorderedCallbacks: 10, newSearchesPreserved: 10, genuineEditsRevoked: 10,
    delayedResponsesDrained: 5, newMedia: 0})) assert.equal(report[key], value);
  assert.equal(report.fullLocalNativeChecksPassed, true);
  for (const key of ['nativeScreenRootCauseConfirmed', 'nativeScreenAccepted', 'nativeSdkAccepted', 'physicalDeviceAccepted', 'releaseComplete'])
    assert.equal(report[key], false);
  const snapshot = JSON.parse(read('source-sha256.json'));
  function archived(path, hash) {
    assert(!posix.isAbsolute(path) && posix.normalize(path) === path && !path.split('/').includes('..') && !path.includes('\\'));
    assert.match(hash, /^[a-f0-9]{64}$/);
    const bytes = readFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'));
    assert.equal(sha(bytes), hash, path); return bytes.toString();
  }
  for (const [kind, mode, count] of [['baseline', 'retained-deferred-callback-order', 176], ['candidate', 'actual-synchronous-selection-state', 177]]) {
    const text = read(kind + '.txt'), metadata = JSON.parse(text.trim().split('\n').at(-1));
    assert.equal(metadata.mode, mode); assert.equal(metadata.compiledInputs, count); assert.equal(metadata.baselineCommit, report.baselineCommit);
    assert.equal(metadata.nativeScreenCauseConfirmed, false); assert.equal(Object.keys(metadata.sourceSha256).length, count + 1);
    for (const [path, hash] of Object.entries(metadata.sourceSha256)) archived(path, hash);
  }
  assert.equal((read('baseline.txt').match(/^Deferred selection observation: .+ erased newer search$/gm) ?? []).length, 10);
  assert.match(read('candidate.txt'), /Synchronous selection checks passed: 10 new searches preserved, 10 genuine edits revoked, 5 delayed responses drained/);
  assert.match(read('candidate.txt'), /root cause remains unconfirmed/);
  for (const phrase of ['SportsGreenMooveNativeChecks passed', 'SearchOwnershipChecks passed: 90', 'OwnedPlacesAdapterChecks passed: 15',
    'UI fixture ownership checks passed: thirteen', 'RideChatAdapterRuntimeChecks passed: 11']) assert(read('native.txt').includes(phrase));
  const files = {};
  for (const kind of ['baseline', 'candidate']) {
    files[kind] = {};
    for (const [path, hash] of Object.entries(snapshot[kind])) files[kind][path] = archived(path, hash);
  }
  const app = 'ios/Sources/SportsGreenMooveApp/';
  assert(files.baseline[app + 'SearchScreen.swift'].includes('.onChange(of: form) { _, _ in appState.invalidateSearch() }'));
  assert(!files.candidate[app + 'SearchScreen.swift'].includes('.onChange(of: form)'));
  assert(files.candidate[app + 'SearchSelectionState.swift'].includes('if form != oldValue && access.isCurrent'));
  assert(files.candidate[app + 'AppState.swift'].includes('if searchOrigin != oldValue { invalidateSearch() }'));
  const ui = 'ios/UITests/SportsGreenMooveUITests/SearchConsentFlowTests.swift';
  assert.equal((files.candidate[ui].match(/func test\w+\(/g) ?? []).length, 2);
  assert.equal((files.candidate[ui].match(/waitForExistence\(timeout: 6\)/g) ?? []).length,
    (files.baseline[ui].match(/waitForExistence\(timeout: 6\)/g) ?? []).length);
  assert(files.candidate[ui].includes('app.debugDescription.prefix(16_000)'));
  assert(!/XCTSkip|sleep\(|continueAfterFailure\s*=/.test(files.candidate[ui]));
  return report;
}
