import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {formFeedbackCases, validateFormFeedbackUnits} from './form-feedback-evidence.mjs';
import {compareFeedbackViewportPixels} from './feedback-text-pixel-review.mjs';

export const formFeedbackVisualFolder = 'docs/release/evidence/form-feedback-visual-2026-11-03/';
export const formFeedbackPublicCases = ['auth-light-phone', 'search-dark-wide', 'chat-error-light-phone',
  'chat-limit-dark-phone', 'chat-sending-light-phone', 'chat-sending-dark-wide'];
const labels = {auth: 'Connexion refusée. Vérifiez votre e-mail et votre mot de passe.',
  search: 'Recherche indisponible. Vos choix sont conservés. Réessayez.',
  'chat-error': 'Envoi non confirmé. Votre message est conservé.', 'chat-limit': 'Maximum 1 000 caractères.', 'chat-sending': 'Envoi en cours...'};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateFormFeedbackVisualReview(root) {
  const folder = resolve(root, formFeedbackVisualFolder), read = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(read(file)); assertEvidenceBundleChecksums(folder);
  const review = json('review.json'), job = json('job.json'), artifact = json('artifact.json');
  const selection = json('selection.json'), hashes = json('artifact-sha256.json'), parity = json('source-parity.json');
  assert.equal(review.scope, 'reviewed-form-feedback-components-with-independent-network-preparation-failure-not-whole-gate-proof');
  assert.equal(review.sourceCommit, 'aab9ac0a2b18fa1a2d43f4310cae2604675b86f7');
  assert.equal(review.sourceRun, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41607543635');
  assert.equal(review.reviewedAt, '2026-11-03'); assert.equal(review.layoutCasesPassed, 4);
  assert.equal(review.viewportsReviewed, 20); assert.equal(review.completeViewportCaptures, 20); assert.equal(review.fontScale, 1.3);
  assert.equal(review.visualContentReviewed, true); assert.equal(review.primaryComponentCopyPassed, true);
  assert.deepEqual(review.publishedCases, formFeedbackPublicCases); assert.equal(review.publishedCaptureKind, 'original-viewport');
  assert.equal(review.publicDelivery, 'unchanged-gallery-jpeg-conversion'); assert.equal(review.originalNetworkFailureRetained, true);
  assert.equal(review.failedNetworkPhase, 'network-preparation');
  for (const key of ['comparisonWindowsPublished', 'mediaEdits', 'mainNativeJobSucceeded', 'fullNativeGateAccepted',
    'independentReplayPassed', 'networkDisconnectionPerformed', 'networkFailureCauseConfirmed', 'physicalDeviceAccepted',
    'authenticationAccepted', 'searchAccepted', 'messageDeliveryAccepted', 'fullAppAccessibilityAccepted', 'releaseAccepted',
    'fallbackAdded', 'deadlineChanged', 'thresholdReduced']) assert.equal(review[key], false, key);
  assert.deepEqual([review.ordinaryCases, review.ordinaryPassed, review.ordinarySkipped, review.ordinaryFailed], [349, 294, 55, 0]);
  assert.equal(job.id, 125821039221); assert.equal(job.run_id, 41607543635);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.steps.find(step => step.name === 'Run Android Compose UI tests')?.conclusion, 'failure');
  assert.equal(artifact.id, 13219461204); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, review.sourceCommit); assert.equal(artifact.size_in_bytes, 33393784);
  assert.equal(selection.originalArchiveBytes, artifact.size_in_bytes);
  assert.equal(selection.originalArchiveSha256, '902a8f15d23e1ec77e039bd319dfb95497fc31dc71783c476615bc1eee8ed72f');
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(selection.originalArchiveRetainedPrivately, true); assert.equal(selection.selectedMembersComparedByteForByte, true);
  const members = Object.fromEntries(formFeedbackCases.flatMap(name => ['.png', '-window.png', '.json'].map(suffix =>
    ['outputs/store-review-screenshots/sgm-feedback-text/form-' + name + suffix, hashes['captures/form-' + name + suffix]])));
  for (const name of ['ordinary-results.json', 'ordinary-instrumentation.txt', 'native-suite-status.json', 'disposable-store-restore.json'])
    members['outputs/store-review-screenshots/' + name] = hashes[name];
  members['outputs/androidTest-results/connected/debug/TEST-guarded-components.xml'] = hashes['TEST-guarded-components.xml'];
  for (const name of ['local-chat-network-ui.json', 'chat-network-validation-before.json', 'chat-network-validation-after.json', 'adb-pull-failure-cleanup.json'])
    members['outputs/local-ui-evidence/32dbe1890e0fb9f6a71043fdd7e4f87a/' + name] = hashes[name];
  assert.deepEqual(selection.members, members); assert.equal(Object.keys(members).length, 69);
  assert.equal(parity.headCommit, review.sourceCommit); assert.equal(parity.checkoutCommit, 'b03d069a4cc8df456f09311715b8995485c68459');
  assert.equal(parity.allSelectedFilesMatch, true); assert.equal(parity.allBuildInputsCompared, false);
  assert.equal(Object.keys(parity.sourceFiles).length, 12); assertRetainedSourceFiles(root, parity.sourceFiles);
  for (const [file, hash] of Object.entries(parity.sourceFiles)) {
    const bytes = readFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'));
    assert.equal(createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex'), parity.githubBlobShas[file]);
  }
  const suite = new XMLParser({ignoreAttributes: false}).parse(read('TEST-guarded-components.xml')).testsuite;
  assert.deepEqual(['tests', 'failures', 'errors', 'skipped'].map(key => suite['@_' + key]), ['349', '0', '0', '55']);
  const rows = suite.testcase.filter(row => row['@_classname'] === 'be.sportgreenmoove.app.ui.FormFeedbackLayoutTest');
  assert.deepEqual(rows.map(row => row['@_name']).sort(), ['light-phone', 'light-wide', 'dark-phone', 'dark-wide']
    .map(name => `actualFormFeedbackIsCompleteAndReadable[${name}]`).sort());
  assert(rows.every(row => !['failure', 'error', 'skipped'].some(key => Object.hasOwn(row, key))));
  const ordinary = json('ordinary-results.json');
  assert.deepEqual([ordinary.complete, ordinary.guardConfirmed, ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed], [true, true, 349, 294, 55, 0]);
  assert.equal(ordinary.installationsRemainedBlocked, true); assert.equal(ordinary.physicalDeviceAccepted, false);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1});
  const restoration = json('disposable-store-restore.json'); assert.equal(restoration.restored, true); assert.equal(restoration.verified, true);
  const network = json('local-chat-network-ui.json'); assert.equal(network.completed, false); assert.equal(network.failedPhase, 'network-preparation');
  assert.deepEqual(network.network, []); assert.equal(network.cellularRequestReleased, true); assert.equal(network.wifiRequestReleased, true);
  const capabilities = network.preparationFailure.capabilityObservation;
  assert.equal(capabilities.atomicObservation, false); assert.deepEqual(capabilities.active.transports, ['cellular']);
  assert.equal(capabilities.active.validated, true); assert.equal(capabilities.available.find(row => row.transports.includes('wifi')).validated, false);
  const history = json('chat-network-validation-after.json'); assert.equal(history.newProbesIssued, false); assert.equal(history.flowCompleted, false);
  assert(history.groups.find(row => row.transports.includes('wifi')).events.some(event => event.errorKind === 'dns-resolution'));
  const comparisons = json('pixel-comparisons.json'), contrasts = [];
  assert.deepEqual(comparisons.map(row => row.case), formFeedbackCases);
  for (const name of formFeedbackCases) {
    const marker = json('captures/form-' + name + '.json'), wide = name.endsWith('-wide');
    assert.equal(marker.scope, 'form-feedback-components-not-auth-search-or-message-delivery-proof');
    assert.equal(marker.case, name); assert.equal(name, marker.screen + '-' + (marker.dark ? 'dark' : 'light') + '-' + (wide ? 'wide' : 'phone'));
    assert.deepEqual([marker.widthDp, marker.heightDp, marker.density, marker.fontScale], wide ? [900, 600, 1, 1.3] : [320, 700, 3, 1.3]);
    assert.equal(marker.completed, true);
    for (const key of ['physicalDevice', 'backendCalls', 'mapsRendered', 'productionWrites']) assert.equal(marker[key], false, key);
    assert(marker.capturedAtEpochMillis >= Date.parse(job.started_at) && marker.capturedAtEpochMillis <= Date.parse(job.completed_at));
    const text = marker.text; assert.equal(text.label, labels[marker.screen]); assert.equal(text.measuredTextFits, true);
    assert.equal(text.lastLineEnd, text.label.length); assert(text.lineCount >= 1 && text.measuredWidthPx > 0);
    assert(Math.ceil(text.measuredParagraphHeightPx) <= text.measuredHeightPx);
    assert(Number.isFinite(text.contrastRatio) && text.contrastRatio >= 4.5); contrasts.push(text.contrastRatio);
    const viewport = read('captures/form-' + name + '.png'), window = read('captures/form-' + name + '-window.png');
    assert.equal(marker.viewportSha256, sha(viewport)); assert.equal(marker.windowSha256, sha(window));
    const observed = compareFeedbackViewportPixels(viewport, window, wide ? {left: 90, top: 900} : {left: 60, top: 150});
    assert.deepEqual(comparisons.find(row => row.case === name), {case: name, ...observed});
    assert.deepEqual([observed.width, observed.height, observed.windowWidth, observed.windowHeight], wide ? [900, 600, 1080, 2400] : [960, 2100, 1080, 2400]);
    assert.equal(observed.changedPixels, 0, name);
  }
  const checks = json('checks.json'); assert.equal(checks.headRefOid, review.sourceCommit); assert.equal(checks.statusCheckRollup.length, 32);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  assert.deepEqual(['SUCCESS', 'SKIPPED', 'FAILURE'].map(value => checks.statusCheckRollup.filter(row => row.conclusion === value).length), [23, 8, 1]);
  const failure = checks.statusCheckRollup.find(row => row.conclusion === 'FAILURE'); assert.equal(failure.name, 'Android native UI tests');
  const previousAppearance = json('previous-appearance.json'); assert.equal(previousAppearance.images.length, 26); assert.equal(previousAppearance.status, 'partial');
  return {...review, previousAppearance, minimumContrast: Math.min(...contrasts), units: validateFormFeedbackUnits(root)};
}
