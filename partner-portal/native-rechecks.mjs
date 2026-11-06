import {rejectedCaptureRecheck} from './rejected-capture-probe.mjs';
import {completeChecks} from './complete-checks.mjs';
import {currentChatRecovery} from './current-chat-recovery.mjs';
import {iosD56FixturePass} from './ios-d56-fixture-pass.mjs';
import {iosAutomatedAcceptance} from './ios-automated-acceptance.mjs';
import {iosLatestRecheck} from './ios-latest-recheck.mjs';
import {protocolQuerySecurity} from './protocol-query-security.mjs';
import {iosSearchSelection} from './ios-search-selection.mjs';
import {ios959Recheck} from './ios-959-recheck.mjs';
import {nativeNetwork959} from './native-network-959.mjs';
import {ios376Acceptance} from './ios-376-acceptance.mjs';
import {nativeCopy376} from './native-copy-376.mjs';
import {ios04Recheck} from './ios-04-recheck.mjs';
import {iosMembershipRecheck964} from './ios-membership-recheck-964.mjs';
import {nativeMatrix964} from './native-matrix-964.mjs';
import {ios0fbRecheck} from './ios-0fb-recheck.mjs';
import {ios6fbAcceptance} from './ios-6fb-acceptance.mjs';
import {iosChildAccount} from './ios-child-account.mjs';
import {nativeCutoff142} from './native-cutoff-142.mjs';
import {iosChildBinding} from './ios-child-binding.mjs';
import {nativeMatrix115, nativeRecheckCc1} from './native-matrix-115.mjs';
import {iosChildPresentation, iosPresentationModules} from './ios-child-presentation.mjs';

export const nativeRechecks = {
  iosPresentationModules,
  iosChildPresentation,
  nativeMatrix115,
  nativeRecheckCc1,
  iosChildBinding,
  nativeCutoff142,
  iosChildAccount,
  ios6fbAcceptance,
  ios0fbRecheck,
  nativeMatrix964,
  iosMembershipRecheck964,
  ios04Recheck,
  nativeCopy376,
  ios376Acceptance,
  nativeNetwork959,
  ios959Recheck,
  iosSearchSelection,
  protocolQuerySecurity,
  iosLatestRecheck,
  iosAutomatedAcceptance,
  currentChatRecovery,
  iosD56FixturePass,
  completeChecks,
  rejectedCaptureRecheck,
  nativeClientClosureRecheck: {source: 'docs/release/evidence/native-admin-close-13a5b1e2-2026-10-24/summary.json', checkedAt: '2026-10-24',
    checksums: 'docs/release/evidence/native-admin-close-13a5b1e2-2026-10-24/artifact-sha256.json'},
  nativeScheduleCopyRecheck: {source: 'docs/release/evidence/native-copy-3413b579-2026-10-23/summary.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/native-copy-3413b579-2026-10-23/artifact-sha256.json'},
  nativePaymentHeadRecheck: {source: 'docs/release/evidence/native-replay-a2f273fb-2026-10-23/summary.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/native-replay-a2f273fb-2026-10-23/artifact-sha256.json'},
  notificationNativeRecovery: {source: 'docs/release/evidence/notification-native-recovery-2026-10-23/summary.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/notification-native-recovery-2026-10-23/artifact-sha256.json'},
  notificationNativeAttempt: {source: 'docs/release/evidence/notification-native-attempt-2026-10-23/summary.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/notification-native-attempt-2026-10-23/artifact-sha256.json'},
  completedNativeReplayRecheck: {source: 'docs/release/evidence/native-replay-0f91172f-2026-10-23/summary.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/native-replay-0f91172f-2026-10-23/artifact-sha256.json'},
  latestNativeCopyRecheck: {source: 'docs/release/evidence/native-copy-ce282274-2026-10-23/summary.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/native-copy-ce282274-2026-10-23/artifact-sha256.json'},
  rideCompletionRecheck: { source: 'docs/release/evidence/ride-completion-recheck-2026-10-23/summary.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/ride-completion-recheck-2026-10-23/artifact-sha256.json' },
  nativeScheduleCollectionRecheck: { source: 'docs/release/evidence/native-terminal-7c7bb699-2026-10-23/run.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/native-terminal-7c7bb699-2026-10-23/artifact-sha256.json' },
  passengerStatusOwnershipRecheck: { source: 'docs/release/evidence/passenger-observation-ownership-2026-10-23/summary.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/passenger-observation-ownership-2026-10-23/artifact-sha256.json' },
  nativeRideCompletionRecheck: { source: 'docs/release/evidence/native-terminal-65c3f0fc-2026-10-23/run.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/native-terminal-65c3f0fc-2026-10-23/artifact-sha256.json' },
  nativeFocusedPreparationRecheck: { source: 'docs/release/evidence/native-terminal-fb628d5b-2026-10-23/summary.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/native-terminal-fb628d5b-2026-10-23/artifact-sha256.json' },
  flowRecheck: {source: 'docs/release/evidence/flow-recheck-2026-10-22/summary.json', checkedAt: '2026-10-22',
    checksums: 'docs/release/evidence/flow-recheck-2026-10-22/artifact-sha256.json'},
  nativeCaptureRecheck: {source: 'docs/release/evidence/native-capture-recheck-24218efd-2026-10-22/summary.json', checkedAt: '2026-10-22',
    checksums: 'docs/release/evidence/native-capture-recheck-24218efd-2026-10-22/artifact-sha256.json'},
  nativeCopyRecheck: {source: 'docs/release/evidence/native-copy-recheck-e23809a-2026-10-22/summary.json', checkedAt: '2026-10-22',
    checksums: 'docs/release/evidence/native-copy-recheck-e23809a-2026-10-22/artifact-sha256.json'},
  nativeReplayRecheck: {source: 'docs/release/evidence/support-process-restart-phone-2026-10-22/summary.json', checkedAt: '2026-10-22',
    checksums: 'docs/release/evidence/support-process-restart-phone-2026-10-22/artifact-sha256.json'},
  nativeTerminalRecheck: {source: 'docs/release/evidence/native-terminal-a6d8a630-2026-10-22/summary.json', checkedAt: '2026-10-22',
    checksums: 'docs/release/evidence/native-terminal-a6d8a630-2026-10-22/artifact-sha256.json'},
  nativeBootRecheck: {source: 'docs/release/evidence/native-boot-bea9e0ee-2026-10-22/summary.json', checkedAt: '2026-10-22',
    checksums: 'docs/release/evidence/native-boot-bea9e0ee-2026-10-22/artifact-sha256.json'},
  nativeMatrixRecheck: {source: 'docs/release/evidence/native-preinstalled-0af0155c-2026-10-22/summary.json', checkedAt: '2026-10-22',
    checksums: 'docs/release/evidence/native-preinstalled-0af0155c-2026-10-22/artifact-sha256.json'},
  nativeTransferRecheck: {source: 'docs/release/evidence/native-transfer-6441dca5-2026-10-23/summary.json', checkedAt: '2026-10-23',
    checksums: 'docs/release/evidence/native-transfer-6441dca5-2026-10-23/artifact-sha256.json'},
};
