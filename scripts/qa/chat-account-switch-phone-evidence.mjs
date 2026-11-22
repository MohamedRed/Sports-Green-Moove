import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {chatAccountSwitchPhases,verifyChatAccountSwitchCheckpoint} from './chat-account-switch-checkpoints.mjs';

export const chatAccountSwitchPhoneFolder='docs/release/evidence/chat-account-switch-phone-2026-11-01/';
export function assertChatAccountSwitchReview(review) {
  assert.equal(review.scope,'physical-pre-commit-pending-chat-privacy-across-parent-driver-account-switch');
  assert.equal(review.reviewedAt,'2026-11-01');assert.equal(review.runId,'6aeabf43b072d5e3ad8357ca3d927277');
  assert.deepEqual(review.device,{model:'Google Pixel 9 Pro',android:'15.0',physical:true});
  for(const key of ['controlledOfflineModeObserved','initialSendUnconfirmed','parentSignedOutWithPendingSend',
    'driverIdentityObserved','sameBookingOpenedByDriver','driverComposerEmpty','driverDidNotSend','driverSignedOut',
    'parentIdentityObservedAgain','parentPendingTextRestored','pendingFieldTapDidNotOpenKeyboardBeforeRetry',
    'noAutomaticSend','oneExplicitParentRetryObserved','singleConfirmedBubbleObserved','composerEmptyAfterConfirmation'])
    assert.equal(review[key],true,key);
  for(const key of ['originalPendingIdentityIndependentlyObserved','postCommitResponseLossAccepted','processRestartAccepted',
    'peerPhoneAccepted','realRadioLossAccepted','trackingAccepted','iOSAccepted','pushDeliveryAccepted',
    'productionWrites','realPayments','applicationDeployed','releaseAccepted'])assert.equal(review[key],false,key);
  assert.equal(review.preRetryZeroMessageCheckpoints,9);assert.equal(review.independentCheckpoints,11);
  assert.equal(review.finalMessageCount,1);assert.equal(review.finalNotificationCount,1);assert.equal(review.mapRequests,0);
  assert.equal(review.captureKind,'original-session-window-crops-not-native-exports');
  assert.deepEqual(review.captureClip,{x:484,y:105,width:198,height:443});
  assert.deepEqual(review.publishedCaptures,['driver-conversation-empty','parent-pending-restored','parent-confirmed']);
  assert.deepEqual(review.privateHelper,{ports:[5001,8080,9000,9099],invitationPortEnabled:false,
    aliasEnabled:false,forceLocal:false,requestLoggingEnabled:false});
}
export function validateChatAccountSwitchPhone(root) {
  const folder=resolve(root,chatAccountSwitchPhoneFolder),bytes=file=>readFileSync(resolve(folder,file)),json=file=>JSON.parse(bytes(file));
  assertEvidenceBundleChecksums(folder);const review=json('review.json');assertChatAccountSwitchReview(review);
  const result=json('records/results.json'),fixture=json('records/fixture.json'),baseline=json('records/baseline.json');
  assert.equal(result.scope,'independent-chat-records-not-account-ui-isolation-or-original-request-identity');
  assert.equal(result.projectId,'demo-sgm-local-qa');assert.equal(result.runId,review.runId);
  assert.equal(result.completed,true);assert.equal(result.failed,false);assert.equal(result.checkpoints.length,11);
  assert.equal(fixture.runId,result.runId);assert.equal(fixture.projectId,result.projectId);assert.deepEqual(fixture.fixture,result.fixture);
  assert.equal(fixture.controllerSubmittedChatMessages,0);assert.deepEqual(result.checkpoints.map(row=>row.phase),chatAccountSwitchPhases);
  let last=0;
  for(const [index,checkpoint]of result.checkpoints.entries()) {
    const observation=json('records/'+checkpoint.phase+'.json');assert.equal(observation.runId,result.runId);
    assert.equal(observation.projectId,result.projectId);assert.deepEqual(observation.check,checkpoint);
    assert.deepEqual(verifyChatAccountSwitchCheckpoint(checkpoint.phase,baseline,observation.state,result.fixture),checkpoint);
    assert.equal(checkpoint.messageCount,index<9?0:1);assert.equal(checkpoint.notificationCount,index<9?0:1);
    const time=Date.parse(observation.observedAt);assert(time>last);last=time;
  }
  for(const key of ['adminClientClosed','firestoreClientTerminated'])assert.equal(result[key],true,key);
  for(const key of ['controllerSubmittedChatMessages','productionWrites','realPayments','accountUiIsolationProvenByObserver',
    'originalPendingIdentityProvenByObserver','postCommitResponseLossExercised'])assert.equal(result[key],false,key);
  assert.equal(result.mapRequests,0);
  const sources=json('source-files.json');assertRetainedSourceFiles(root,sources);
  for(const [file,hash]of Object.entries(result.sourceFiles))assert.equal(sources[file],hash);
  const apk=json('apk-provenance.json');
  assert.equal(apk.sourceCommit,'86746f4c1a9c58a583073e0f64292ec1146cda90');
  assert.equal(apk.sha256,'f707cb41e5b59147acc9e94c69115edbe6dc95c528b52586fb36c83eefe524e8');
  assert.equal(apk.filename,'sgm-chat-draft-86746f4.apk');assert.equal(apk.projectId,result.projectId);
  assert.equal(apk.selectedFilenameObserved,true);assert.equal(apk.installedBytesIndependentlyAttested,false);
  assert.equal(apk.wholeCurrentApkAttested,false);assert.equal(apk.criticalSourceFilesUnchanged,6);
  const times=json('capture-times.json');assert.equal(Object.keys(times).length,14);let previous=0;
  for(const [file,stamp]of Object.entries(times)) {
    assert.match(file,/^captures\/[a-z-]+\.png$/);const dimensions=imageSize(bytes(file));
    assert.equal(dimensions.width,198);assert.equal(dimensions.height,443);
    const time=Date.parse(stamp);assert(time>previous);previous=time;
  }
  for(const name of review.publishedCaptures)assert(times['captures/'+name+'.png']);
  assert.match(bytes('network-restored-ax.txt').toString(),/Offline Mode.+Value: 0/);
  assert.match(bytes('uninstall-result.txt').toString(),/No user apps found to uninstall/);
  const disposal=json('disposal.json');assert(Date.parse(disposal.observedAt)>last&&Date.parse(disposal.observedAt)>previous);
  for(const key of ['signedOutObserved','networkSimulationDisabledObserved','firstStopClickDidNotEndSession',
    'secondExplicitStopEndedSession','sessionEnded','idleDashboardObserved','privateSessionAbsent','runtimeAbsent',
    'helperDirectoryAbsent','helperRequestedStop','helperGroupExitVerified','ownedProcessesAbsent','clipboardCleared'])assert.equal(disposal[key],true,key);
  for(const key of ['providerUninstallCompletionAccepted','packageAbsenceIndependentlyVerified','originalHostClipboardRestorationVerified',
    'deviceAdministratorChanged','screenSharingPermissionsChanged','chromeRestarted'])assert.equal(disposal[key],false,key);
  assert.equal(disposal.helperExitCode,130);assert.equal(disposal.backendExitCode,130);
  assert.deepEqual(disposal.ports,{host:'127.0.0.1',ports:[5001,8080,9000,9099],closed:true});
  const preparation=json('preparation-observations.json');
  for(const key of ['helperInputFailed','credentialRotated','secretPrinted','privateScopeExpanded',
    'driverCredentialRejectionRootCauseIndependentlyConfirmed','videoRecordingAttempted',
    'screenSharingPermissionsChanged','chromeRestarted'])assert.equal(preparation[key],false,key);
  for(const key of ['directPrivateCredentialTransferSucceeded','credentialMaskedAgain',
    'parentAndDriverSawCredentialRejectionBeforeSuccessfulSignIn','remoteMessageInsertedFromKeyboardClipboardBeforeSend'])assert.equal(preparation[key],true,key);
  const job=json('focused-chat-ci-job.json'),artifact=json('ci/artifact.json'),provenance=json('ci/provenance.json');
  assert.equal(job.id,124696142255);assert.equal(job.run_id,41254990765);assert.equal(job.conclusion,'failure');
  assert.equal(job.head_sha,apk.backendPreparedFromCommit);assert.equal(artifact.id,13063250481);
  assert.equal(artifact.digest,'sha256:'+provenance.archiveSha256);assert.equal(provenance.physicalResultOverridesFailure,false);
  const failed=json('ci/local-chat-network-ui.json');assert.equal(failed.completed,false);assert.equal(failed.failedPhase,'network-preparation');
  assert.deepEqual(failed.network,[]);assert.equal(failed.preparationFailure.hasDefaultDataSubscription,false);
  assert.equal(failed.preparationFailure.cellularAvailableCallbacks,0);assert.equal(failed.preparationFailure.backendReachable,true);
  assert.match(bytes('ci/LocalChatNetworkFlowTest-instrumentation.txt').toString(),/ComposeTimeoutException/);
  return {physicalControlledAccountSwitchPassed:true,checkpoints:11,messages:1,notifications:1,
    originalPendingIdentityAccepted:false,postCommitResponseLossAccepted:false,releaseAccepted:false};
}
