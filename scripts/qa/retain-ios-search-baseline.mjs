import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/ios-search-ownership-2026-11-05');
mkdirSync(folder, {recursive: true}); assert(!existsSync(resolve(folder, 'baseline.json')));
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const result = readFileSync(resolve(input, 'sgm-search-ownership-baseline-v2-20261105.log'));
assert(result.toString().includes('22 stale/private response restorations, 24 unfinished callbacks without an account lease; not accepted'));
writeFileSync(resolve(folder, 'baseline-result.txt'), result, {flag: 'wx'});
const paths = ['AppState.swift', 'AppState+Search.swift', 'AccountWorkScope.swift', 'SearchRequestState.swift',
  'SearchFormState.swift', 'SearchScreen.swift', 'GatewayContracts.swift', 'FirebaseSearchGateway.swift',
  'PublishController.swift'].map(name => 'ios/Sources/SportsGreenMooveApp/' + name);
paths.push('scripts/check-ios-native-plan.sh', 'ios/Tests/SportsGreenMooveNativeChecks/main.swift',
  'ios/Tests/SportsGreenMooveNativeChecks/AppDataProbe.swift', 'ios/Tests/SportsGreenMooveNativeChecks/SearchOwnershipReproduction.swift');
const files = paths.map(path => {
  const bytes = readFileSync(resolve(root, path)), sha256 = hash(bytes);
  const archive = resolve(root, 'docs/release/evidence/source-archive', sha256 + '.txt');
  if (!existsSync(archive)) writeFileSync(archive, bytes, {flag: 'wx'});
  assert.equal(hash(readFileSync(archive)), sha256); return {path, sha256};
});
writeFileSync(resolve(folder, 'baseline-source-sha256.json'), json({files}), {flag: 'wx'});
writeFileSync(resolve(folder, 'baseline.json'), json({checkedAt: '2026-11-05',
  sourceCommit: 'a37cdbf263642d2a9a26a0af3cf2b0363886bb97', scope: 'controlled-actual-app-search-negative-reproduction',
  result: 'not-accepted', staleResponseRestorations: 22, callbacksMissingAccountLease: 24,
  resultFile: 'baseline-result.txt', resultSha256: hash(result), providerRequests: 0, productionWrites: 0,
  nativeUiAccepted: false, physicalDeviceAccepted: false, releaseComplete: false}), {flag: 'wx'});
console.log('Retained the actual negative search reproduction and its exact controlled source.');
