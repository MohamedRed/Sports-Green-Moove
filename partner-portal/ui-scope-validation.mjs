import assert from 'node:assert/strict';
import { validateTeamChatComponents, teamChatComponentScope } from '../scripts/qa/team-chat-ui-evidence.mjs';
import { sessionDisconnectScope } from '../scripts/qa/session-disconnect-evidence.mjs';
import { validateSessionDisconnectReport } from '../scripts/qa/session-disconnect-retained-evidence.mjs';
import { sessionRestorationScope, validateSessionRestorationReport } from '../scripts/qa/session-restoration-retained-evidence.mjs';
import { emergencyIdentityScope, validateEmergencyIdentityReport } from '../scripts/qa/emergency-identity-retained-evidence.mjs';
import { correctedChildContactScope, validateChildContactComponents } from '../scripts/qa/child-emergency-evidence.mjs';
import { remoteRideStopScope, validateRemoteRideStopReport } from '../scripts/qa/remote-ride-stop-evidence.mjs';
import { validateNativeStartupReport } from '../scripts/qa/native-startup-retained-evidence.mjs';
import { validateRideObservationReport } from '../scripts/qa/ride-observation-retained-evidence.mjs';
import { validateRideEmergencyReport } from '../scripts/qa/ride-emergency-retained-evidence.mjs';
import { validateTeamReviewReport } from '../scripts/qa/team-review-evidence.mjs';

export function validateUiScope(run) {
  switch (run.scope) {
    case teamChatComponentScope: validateTeamChatComponents(run); break;
    case sessionDisconnectScope: validateSessionDisconnectReport(run); break;
    case sessionRestorationScope: validateSessionRestorationReport(run); break;
    case emergencyIdentityScope: validateEmergencyIdentityReport(run); break;
    case 'executed-local-child-contact-components-not-child-signin-or-dialer':
    case correctedChildContactScope: validateChildContactComponents(run); break;
    case remoteRideStopScope: validateRemoteRideStopReport(run); break;
    case 'local-fused-mock-startup-not-physical-gps': validateNativeStartupReport(run); break;
    case 'local-ride-live-sdk-not-physical-gps': validateRideObservationReport(run); break;
    case 'local-active-ride-contact-with-sdk-and-dialer-not-physical': validateRideEmergencyReport(run); break;
    case 'local-team-manager-review-not-physical-or-parent-native-ui': validateTeamReviewReport(run); break;
    case 'isolated-guardian-review-http-not-native-ui':
      assert.equal(run.projectId, 'demo-sgm-local-qa');
      assert.equal(run.productionWrites, false); assert.equal(run.physicalDevice, false);
      assert.equal(run.providerRequests, 0);
      assert.equal(run.browser?.scope, 'local-management-browser-not-native-or-physical');
      assert.equal(run.browser.externalRequests, 0); assert.equal(run.browser.productionWrites, false);
      assert.equal(run.browser.checks.length, 9);
      assert(run.browser.checks.every((check) => check.status === 'passed'));
      assert.equal(new Set(run.browser.checks.map((check) => check.id)).size, 9);
      break;
    case 'local-ui-not-physical-device': assert.equal(run.projectId, 'demo-sgm-local-qa'); break;
    case 'local-native-component-ui-not-physical-device':
      assert.equal(run.projectId, null, 'Component fixtures do not connect to an application project');
      assert.equal(run.applicationBackendConnected, false);
      assert.equal(run.gateway, 'in-memory-fixture');
      assert.equal(run.fullAppReplay, false);
      assert.equal(run.physicalDevice, false);
      assert.equal(run.realProviderOutcomesVerified, false);
      assert.equal(run.componentSuiteCompleted, true);
      assert.equal(run.failures, 0); assert.equal(run.errors, 0); assert.equal(run.skipped, 0);
      assert(Number.isSafeInteger(run.testCount) && run.testCount > 0);
      assert.equal(run.steps.length, run.testCount);
      assert(run.steps.every((step) => step.status === 'passed'));
      assert.equal(new Set(run.steps.map((step) => step.id)).size, run.testCount);
      assert.match(run.sourceCommit, /^[a-f0-9]{40}$/);
      assert.match(run.sourceRun, /^https:\/\/github\.com\/MohamedRed\/Sports-Green-Moove\/actions\/runs\/\d+$/);
      break;
    default: assert.fail('Unknown UI evidence scope');
  }
}
