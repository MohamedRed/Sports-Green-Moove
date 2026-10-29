import {validateRequestSafetyEvidence} from '../scripts/qa/http-body-parser-evidence.mjs';
import {validateDependencyPatchEvidence} from '../scripts/qa/dependency-patch-evidence.mjs';
import {validateNativeGateRecheck} from '../scripts/qa/native-gate-recheck-evidence.mjs';
import {validatePublishedMediaSeek} from '../scripts/qa/published-media-seek-evidence.mjs';
import {validateBufferedMediaEvidence} from '../scripts/qa/buffered-media-evidence.mjs';
import {validateReviewHistoryEvidence} from '../scripts/qa/review-history-evidence.mjs';
import {validateReviewPhoneEvidence} from '../scripts/qa/review-history-phone-evidence.mjs';
import {validateReceivedRatingsEvidence} from '../scripts/qa/received-ratings-evidence.mjs';
import {validateReviewPaginationEvidence} from '../scripts/qa/review-pagination-evidence.mjs';
import {validateReviewDisplayEvidence} from '../scripts/qa/review-display-evidence.mjs';
import {validateReviewContextEvidence} from '../scripts/qa/review-context-evidence.mjs';
import {validateReviewBaselineGate} from '../scripts/qa/review-baseline-gate-evidence.mjs';

export function validateCurrentChecks(root, content) {
  validateRequestSafetyEvidence(root, content.requestSafetyRecheck);
  validateDependencyPatchEvidence(root, content.dependencyPatchRecheck);
  validateNativeGateRecheck(root, content.nativeGateRecheck);
  validatePublishedMediaSeek(root, content.publishedMediaReview);
  validateBufferedMediaEvidence(root, content.publishedMediaPlayback);
  validateReviewHistoryEvidence(root, content.reviewHistoryRecheck);
  validateReviewPhoneEvidence(root, content.reviewHistoryPhone);
  validateReceivedRatingsEvidence(root, content.receivedRatingsRecheck);
  validateReviewPaginationEvidence(root, content.reviewPaginationRecheck);
  validateReviewDisplayEvidence(root, content.reviewDisplayRecheck);
  validateReviewContextEvidence(root, content.reviewContextRecheck);
  validateReviewBaselineGate(root, content.reviewBaselineGateRecheck);
}
