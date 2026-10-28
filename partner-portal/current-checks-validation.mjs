import {validateRequestSafetyEvidence} from '../scripts/qa/http-body-parser-evidence.mjs';
import {validateDependencyPatchEvidence} from '../scripts/qa/dependency-patch-evidence.mjs';
import {validateNativeGateRecheck} from '../scripts/qa/native-gate-recheck-evidence.mjs';
import {validatePublishedMediaSeek} from '../scripts/qa/published-media-seek-evidence.mjs';

export function validateCurrentChecks(root, content) {
  validateRequestSafetyEvidence(root, content.requestSafetyRecheck);
  validateDependencyPatchEvidence(root, content.dependencyPatchRecheck);
  validateNativeGateRecheck(root, content.nativeGateRecheck);
  validatePublishedMediaSeek(root, content.publishedMediaReview);
}
