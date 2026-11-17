import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {searchSelectionFolder, validateSearchSelectionEvidence} from './ios-search-selection-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2], base = resolve(root, searchSelectionFolder);
assert(input?.startsWith('/')); assert(!existsSync(base));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), baseline = '959e70b41abb039037f94e6eeec8402b597b5bff';
const logs = Object.fromEntries(['baseline', 'candidate', 'native'].map(kind =>
  [kind, readFileSync(resolve(input, `sgm-search-selection-${kind}-20261106.log`))]));
const sources = {baseline: {}, candidate: {}};
function archive(path, bytes, kind) {
  const hash = sha(bytes), target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(target)), hash); sources[kind][path] = hash;
}
for (const kind of ['baseline', 'candidate']) {
  const metadata = JSON.parse(logs[kind].toString().trim().split('\n').at(-1));
  for (const [path, hash] of Object.entries(metadata.sourceSha256)) {
    const bytes = kind === 'baseline' && !path.startsWith('tests/fixtures/ios-search-selection/') ?
      execFileSync('git', ['show', `${baseline}:${path}`], {cwd: root}) : readFileSync(resolve(root, path));
    assert.equal(sha(bytes), hash); archive(path, bytes, kind);
  }
  const paths = ['ios/Sources/SportsGreenMooveApp/SearchScreen.swift', 'ios/Sources/SportsGreenMooveApp/AppShell.swift',
    'ios/UITests/SportsGreenMooveUITests/SearchConsentFlowTests.swift', '.github/workflows/ios-mvp-verification.yml'];
  for (const path of paths) archive(path, kind === 'baseline' ? execFileSync('git', ['show', `${baseline}:${path}`], {cwd: root}) : readFileSync(resolve(root, path)), kind);
}
mkdirSync(base); const hashes = {};
function record(file, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes.toString()));
  writeFileSync(resolve(base, file), bytes, {flag: 'wx'}); hashes[file] = sha(bytes);
}
for (const [kind, log] of Object.entries(logs)) record(kind + '.txt', log);
record('source-sha256.json', sources);
record('summary.json', {checkedAt: '2026-11-06', baselineCommit: baseline,
  scope: 'controlled-search-selection-order-and-local-native-logic-not-screen-diagnosis',
  baselineReorderedCallbacks: 10, newSearchesPreserved: 10, genuineEditsRevoked: 10, delayedResponsesDrained: 5,
  fullLocalNativeChecksPassed: true, newMedia: 0, nativeScreenRootCauseConfirmed: false, nativeScreenAccepted: false,
  nativeSdkAccepted: false, physicalDeviceAccepted: false, releaseComplete: false});
writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes, null, 2) + '\n', {flag: 'wx'});
validateSearchSelectionEvidence(root); console.log('Retained controlled reorder reproduction and synchronous search checks; no native-screen diagnosis or acceptance.');
