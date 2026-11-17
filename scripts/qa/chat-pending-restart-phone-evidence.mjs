import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {chatPendingRestartPhases,verifyChatPendingRestartCheckpoint} from './chat-pending-restart-checkpoints.mjs';

export const chatPendingRestartPhoneFolder='docs/release/evidence/chat-pending-restart-phone-2026-10-31/';
export function assertChatPendingRestartReview(review) {
  assert.equal(review.scope,'physical-pending-chat-restored-after-android-force-stop-before-server-commit');
  assert.equal(review.reviewedAt,'2026-10-31');assert.equal(review.runId,'10ab1d39ca92b3d2da7a23afbe7f362a');
  assert.deepEqual(review.device,{model:'Google Pixel 9 Pro',android:'15.0',physical:true});
  for(const key of ['controlledOfflineModeObserved','initialSendUnconfirmed','androidForceStopConfirmationObserved',
    'androidForceStopDisabledAfter','reopenedInstalledAppWithoutReinstall','offlineSessionRecoveryErrorObserved',
    'oneExplicitSessionRetryObserved','authenticatedHomeReturnedWithoutLogin','pendingTextRestored',
    'pendingFieldTapDidNotOpenKeyboard','noMessageBeforeExplicitRetry','oneExplicitMessageRetryObserved',
    'singleConfirmedBubbleObserved','composerEmptyAfterConfirmation']) assert.equal(review[key],true,key);
  for(const key of ['independentProcessIdsObserved','originalPendingIdentityIndependentlyObserved','postCommitResponseLossAccepted',
    'accountSwitchOnPhoneAccepted','peerPhoneAccepted','realRadioLossAccepted','trackingAccepted','iOSAccepted',
    'pushDeliveryAccepted','productionWrites','realPayments','applicationDeployed','releaseAccepted']) assert.equal(review[key],false,key);
  assert.equal(review.preRetryZeroMessageCheckpoints,7);assert.equal(review.independentCheckpoints,9);
  assert.equal(review.finalMessageCount,1);assert.equal(review.finalNotificationCount,1);assert.equal(review.mapRequests,0);
  assert.equal(review.captureKind,'original-session-window-crops-not-native-exports');
  assert.deepEqual(review.captureClip,{x:451,y:97,width:216,height:458});
  assert.deepEqual(review.publishedCaptures,['offline-unconfirmed','pending-restored','confirmed']);
  assert.deepEqual(review.privateHelper,{ports:[5001,8080,9000,9099],invitationPortEnabled:false,
    aliasEnabled:false,forceLocal:false,requestLoggingEnabled:false});
}
export function validateChatPendingRestartPhone(root) {
  const folder=resolve(root,chatPendingRestartPhoneFolder),bytes=file=>readFileSync(resolve(folder,file)),json=file=>JSON.parse(bytes(file));
  assertEvidenceBundleChecksums(folder);const review=json('review.json');assertChatPendingRestartReview(review);
  const result=json('records/results.json'),fixture=json('records/fixture.json'),baseline=json('records/baseline.json');
  assert.equal(result.scope,'independent-pending-chat-records-not-phone-ui-process-death-or-original-request-identity');
  assert.equal(result.projectId,'demo-sgm-local-qa');assert.equal(result.runId,review.runId);
  assert.equal(result.completed,true);assert.equal(result.failed,false);assert.equal(result.checkpoints.length,9);
  assert.equal(fixture.runId,result.runId);assert.equal(fixture.projectId,result.projectId);assert.deepEqual(fixture.fixture,result.fixture);
  assert.equal(fixture.controllerSubmittedChatMessages,0);
  assert.deepEqual(result.checkpoints.map(row=>row.phase),chatPendingRestartPhases);
  let last=0;
  for(const [index,checkpoint]of result.checkpoints.entries()) {
    const observation=json('records/'+checkpoint.phase+'.json');assert.equal(observation.runId,result.runId);
    assert.equal(observation.projectId,result.projectId);assert.deepEqual(observation.check,checkpoint);
    const check=verifyChatPendingRestartCheckpoint(checkpoint.phase,baseline,observation.state,result.fixture);
    assert.deepEqual(check,checkpoint);assert.equal(check.messageCount,index<7?0:1);assert.equal(check.notificationCount,index<7?0:1);
    const time=Date.parse(observation.observedAt);assert(Number.isFinite(time)&&time>last);last=time;
  }
  for(const key of ['adminClientClosed','firestoreClientTerminated'])assert.equal(result[key],true,key);
  for(const key of ['controllerSubmittedChatMessages','productionWrites','realPayments','phoneUiProvenByObserver',
    'processDeathProvenByObserver','originalPendingIdentityProvenByObserver','postCommitResponseLossExercised'])assert.equal(result[key],false,key);
  assert.equal(result.mapRequests,0);
  const sources=json('source-files.json');assertRetainedSourceFiles(root,sources);
  for(const [file,hash]of Object.entries(result.sourceFiles))assert.equal(sources[file],hash);
  const apk=json('apk-provenance.json');
  assert.equal(apk.sourceCommit,'86746f4c1a9c58a583073e0f64292ec1146cda90');
  assert.equal(apk.sha256,'f707cb41e5b59147acc9e94c69115edbe6dc95c528b52586fb36c83eefe524e8');
  assert.equal(apk.filename,'sgm-chat-draft-86746f4.apk');assert.equal(apk.packageName,'be.sportgreenmoove.app.local');
  assert.equal(apk.projectId,result.projectId);assert.equal(apk.emulatorHost,'127.0.0.1');assert.equal(apk.realMapsUi,false);
  assert.equal(apk.selectedFilenameObserved,true);assert.equal(apk.installedBytesIndependentlyAttested,false);
  assert.equal(apk.wholeCurrentApkAttested,false);assert.equal(apk.criticalSourceFilesUnchanged,6);
  const times=json('capture-times.json');let previous=0;
  for(const name of ['ready','offline-unconfirmed','force-stop-dialog','force-stopped','reopened-offline',
    'online-before-session-retry','session-restored','pending-restored','confirmed','signed-out']) {
    const file='captures/'+name+'.png',dimensions=imageSize(bytes(file));assert.equal(dimensions.width,216);assert.equal(dimensions.height,458);
    const time=Date.parse(times[file]);assert(time>previous);previous=time;
  }
  assert.match(bytes('process-observation-before.txt').toString(),/command invalid or not supported: pidof be\.sportgreenmoove\.app\.local/);
  assert.match(bytes('uninstall-observation.txt').toString(),/No user apps found to uninstall/);
  assert.match(bytes('network-restored-ax.txt').toString(),/Offline Mode.+Value: 0/);
  const preparation=json('preparation-observations.json');
  for(const key of ['initialHelperPrivateInputFailed','followupClipboardReadReturnedEmpty','initialHelperGroupExitVerified',
    'initialHelperDirectoryAbsent','directPrivateCredentialTransferSucceeded','credentialMaskedAgain',
    'emailInputCorrectedBeforeSuccessfulSignIn','remoteKeyboardTextCorrectedBeforeFirstSend',
    'videoModalRequestedScreenSharingPermission'])assert.equal(preparation[key],true,key);
  for(const key of ['initialHelperFailureRootCauseConfirmed','secretPrinted','credentialRotated','privateScopeExpanded',
    'videoRecordingStarted','videoFailureRootCauseConfirmed','screenSharingPermissionsChanged','chromeRestarted'])assert.equal(preparation[key],false,key);
  assert.equal(preparation.initialHelperFailureCode,'ERR_ASSERTION');assert.equal(preparation.videoFailureModal,'Video recording failed to start');
  const disposal=json('disposal.json');assert(Date.parse(disposal.observedAt)>last&&Date.parse(disposal.observedAt)>previous);
  for(const key of ['signedOutObserved','networkSimulationDisabledObserved','sessionEnded','idleDashboardObserved',
    'privateSessionAbsent','runtimeAbsent','helperDirectoriesAbsent','helperRequestedStop','helperGroupExitVerified',
    'ownedProcessesAbsent','clipboardCleared'])assert.equal(disposal[key],true,key);
  for(const key of ['providerUninstallCompletionAccepted','packageAbsenceIndependentlyVerified',
    'originalHostClipboardRestorationVerified','deviceAdministratorChanged','screenSharingPermissionsChanged','chromeRestarted'])assert.equal(disposal[key],false,key);
  assert.equal(disposal.helperExitCode,130);assert.equal(disposal.backendExitCode,130);
  assert.equal(disposal.providerUninstallResult,'No user apps found to uninstall.');
  assert.deepEqual(disposal.ports,{host:'127.0.0.1',ports:[5001,8080,9000,9099],closed:true});
  return {physicalPreCommitPendingRestartPassed:true,checkpoints:9,messages:1,notifications:1,
    originalPendingIdentityAccepted:false,postCommitResponseLossAccepted:false,releaseAccepted:false};
}
