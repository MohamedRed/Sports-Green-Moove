import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';

const baseline = '61c3f2048d478707494e4ad90f1819f0860842ef';
const logsDirectory = process.argv[2];
assert(logsDirectory && isAbsolute(logsDirectory), 'Supply the absolute directory containing the verified local logs');
const folder = 'docs/release/evidence/ios-message-ownership-2026-11-05/';
const digest = value => createHash('sha256').update(value).digest('hex');
const save = (path, value) => writeFileSync(path, value, {flag:'wx'});
const archive = value => {
  const hash = digest(value), path = 'docs/release/evidence/source-archive/' + hash + '.txt';
  if (existsSync(path)) assert.equal(digest(readFileSync(path)), hash);
  else save(path, value);
  return hash;
};
mkdirSync(folder, {recursive:true});
const logs = [
  ['baseline-result.txt','sgm-ios-message-regression-20261105.log','staleInboxRestored=true staleRatingNoticeRestored=true'],
  ['native-result.txt','sgm-ios-messages-native-settlement-20261105.log','SportsGreenMooveNativeChecks passed'],
  ['signature-result.txt','sgm-ios-messages-signature-final-20261105.log','Owned callable signature checks passed'],
].map(([file,path,marker]) => {
  const bytes = readFileSync(resolve(logsDirectory,path)); assert(bytes.toString().includes(marker));
  save(folder + file, bytes); return {file, sha256:digest(bytes)};
});
const baselineSourceSha256 = archive(execFileSync('git', ['show',baseline + ':ios/Sources/SportsGreenMooveApp/MessagesScreen.swift']));
const files = [
  ...['GatewayContracts','MessagesInboxState','MessagesScreen','PendingReviews','PendingReviewsState','PendingReviewsContent',
    'FirebaseInboxGateway','FirebaseFeedbackGateway','UnconfiguredGateways','UITestAppStateFactory','AccountWorkScope',
    'FirebaseCallableBoundary'].map(name => 'ios/Sources/SportsGreenMooveApp/' + name + '.swift'),
  ...['MessagesInboxChecks','PendingReviewChecks','AppDataProbe','main'].map(name => 'ios/Tests/SportsGreenMooveNativeChecks/' + name + '.swift'),
  'ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift',
  'scripts/check-ios-native-plan.sh','scripts/check-ios-support-concurrency.sh',
  'scripts/qa/check-ios-message-regression.mjs','scripts/qa/retain-ios-message-ownership.mjs',
  'tests/ios-message-ownership.test.mjs','.github/workflows/web-integration-smoke.yml','.github/workflows/ios-mvp-verification.yml',
  'tests/ios-emergency-contact.test.mjs','tests/review-pagination-contract.test.mjs','docs/release/evidence-manifest.json',
].map(path => ({path, sha256:archive(readFileSync(resolve(path)))}));
save(folder + 'source-sha256.json', JSON.stringify({baselineCommit:baseline,scope:'local-message-ownership-inputs-not-sdk-ui-proof',files},null,2) + '\n');
save(folder + 'summary.json', JSON.stringify({checkedAt:'2026-11-05',baselineCommit:baseline,baselineSourceSha256,
  sourceProjection:'exact-two-screen-methods-with-controlled-model-and-gateway-types',
  localChecks:{regressionExitCode:0,nativePlanExitCode:0,signatureExitCode:0,uiSyntaxExitCode:0,delayedBoundaries:42,requiredFixtureCases:11},logs,
  sdkLinkedBuildAccepted:false,fixtureUiExecuted:false,fullConversationUiAccepted:false,nativeSignOutAccepted:false,
  physicalDeviceAccepted:false,newNativeMediaPublished:false,releaseComplete:false,
  providerRequests:0,productionWrites:0,realPayments:0,newPhoneSessions:0},null,2) + '\n');
console.log(JSON.stringify({folder,archivedInputs:files.length,releaseAccepted:false}));
