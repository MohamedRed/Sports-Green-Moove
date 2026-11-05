import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';

const input = process.argv[2]; assert(input && isAbsolute(input),'Supply the verified local log directory');
const folder = 'docs/release/evidence/ios-contact-request-2026-11-05/';
const failed = '84c9b627acfcebbddaad147bdd282af8483ce943';
const hash = value => createHash('sha256').update(value).digest('hex');
const save = (name,value) => writeFileSync(folder + name,value,{flag:'wx'});
const read = name => readFileSync(resolve(input,name));
const archive = bytes => {
  const sha256 = hash(bytes), path = 'docs/release/evidence/source-archive/' + sha256 + '.txt';
  if(existsSync(path)) assert.equal(hash(readFileSync(path)),sha256);
  else writeFileSync(path,bytes,{flag:'wx'});
  return sha256;
};
mkdirSync(folder,{recursive:true});
const run = read('sgm-ios-84c9-terminal-run-20261105.json'), metadata = JSON.parse(run);
assert.equal(metadata.headSha,failed); assert.equal(metadata.status,'completed'); assert.equal(metadata.conclusion,'failure');
assert.equal(metadata.jobs.find(x=>x.databaseId===126960411175).steps.find(x=>x.name==='Dispose isolated simulator').conclusion,'success');
const inventory = read('sgm-ios-84c9-terminal-artifacts-20261105.json'); assert.equal(JSON.parse(inventory).total_count,0);
const original = read('sgm-ios-84c9-terminal-20261105.log');
const diagnostics = original.toString().split('\n').filter(line=>/FirebaseEmergencyContactGateway.swift:31:55: (error|note):/.test(line));
assert(diagnostics.some(line=>line.includes("sending value of non-Sendable type '[String : Any]'")));
const firstError = diagnostics.find(line=>line.includes(': error:')), firstNote = diagnostics.find(line=>line.includes(': note:'));
assert(firstError && firstNote);
const selected = [
  ['terminal-run.json',run],['artifact-inventory.json',inventory],
  ['compiler-diagnostic.txt',Buffer.from(firstError + '\n' + firstNote + '\n')],
  ['native-result.txt',read('sgm-ios-contact-sending-native-final-20261105.log')],
  ['signature-result.txt',read('sgm-ios-contact-sending-signature-20261105.log')],
];
assert(selected.find(x=>x[0]==='native-result.txt')[1].toString().includes('EmergencyContactRequestChecks passed: 10 exact request variants and 10 invalid inputs'));
assert(selected.find(x=>x[0]==='signature-result.txt')[1].toString().includes('Owned callable signature checks passed'));
const records = selected.map(([file,bytes])=>{save(file,bytes);return {file,sha256:hash(bytes)};});
const files = [
  ...['EmergencyContactRequest','FirebaseEmergencyContactGateway','FirebaseFeedbackGateway','EmergencyContactWire','EmergencyContactModels',
    'GuardianContactModels'].map(name=>'ios/Sources/SportsGreenMooveApp/' + name + '.swift'),
  'ios/Tests/SportsGreenMooveNativeChecks/EmergencyContactRequestChecks.swift','ios/Tests/SportsGreenMooveNativeChecks/main.swift',
  'scripts/check-ios-native-plan.sh','scripts/check-ios-support-concurrency.sh','tests/fixtures/ios-support-concurrency/FirebaseFunctions.swift',
  'scripts/qa/retain-ios-contact-request.mjs','tests/ios-contact-request.test.mjs','tests/ios-emergency-contact.test.mjs',
  'tests/ios-parent-contact.test.mjs','tests/web-smoke-sharding.test.mjs','.github/workflows/ios-mvp-verification.yml',
  '.github/workflows/web-integration-smoke.yml','docs/release/ios-mvp-verification.md',
  'partner-portal/progress-current.mjs',
].map(path=>({path,sha256:archive(readFileSync(path))}));
const failedGatewaySha256 = archive(execFileSync('git',['show',failed + ':ios/Sources/SportsGreenMooveApp/FirebaseEmergencyContactGateway.swift']));
save('source-sha256.json',JSON.stringify({baselineCommit:'8cc5511d6e88e2a453c3663e426874ffbdce8764',scope:'typed-contact-request-candidate-not-sdk-ui-acceptance',files},null,2)+'\n');
save('summary.json',JSON.stringify({checkedAt:'2026-11-05',failedSourceCommit:failed,runId:41935572872,jobId:126960411175,
  url:'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41935572872/job/126960411175',failedGatewaySha256,
  originalJobLogSha256:hash(original),compilerDiagnosticOccurrences:diagnostics.filter(x=>x.includes(': error:')).length,
  failedStep:'Compile app and all fixture test bundles',deadlineFailure:false,artifactCount:0,disposalSucceeded:true,
  resolvedFirebaseVersion:'12.19.3',sdkDeclarationSource:'https://github.com/firebase/firebase-ios-sdk/blob/12.19.3/FirebaseFunctions/Sources/HTTPSCallable.swift',
  localChecks:{nativePlanExitCode:0,signatureExitCode:0,exactRequestVariants:10,invalidInputsRejected:10},records,
  candidateSdkBuildAccepted:false,fixtureUiExecuted:false,fullConversationAccepted:false,physicalDeviceAccepted:false,
  newNativeMediaPublished:false,releaseComplete:false,providerRequests:0,productionWrites:0,realPayments:0,newPhoneSessions:0},null,2)+'\n');
console.log(JSON.stringify({folder,sourceInputs:files.length,originalFailureRetained:true,sdkAcceptanceAdded:false}));
