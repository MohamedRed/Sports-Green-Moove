import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { content, assets, captures, excerpts } from '../partner-portal/content.mjs';
import { validate } from '../partner-portal/validate.mjs';
import { assetRevision, buildBrowserAssets, assertBrowserAssetsCurrent } from '../partner-portal/build-assets.mjs';
import { nativeRechecks } from '../partner-portal/native-rechecks.mjs';
import { evidenceSourcePaths } from '../partner-portal/evidence-fingerprints.mjs';
import {validateNativeStatus} from '../partner-portal/native-status-validation.mjs';

const root = resolve(import.meta.dirname, '..');
const source = (file) => readFileSync(resolve(root, file), 'utf8');

test('every flow has truthful, dated evidence and explicit remaining scope', () => {
  assert.equal(validate(root), true);
  assert(content.flows.length >= 14);
  assert.equal(content.flows.find((f) => f.id === 'tracking').status, 'partial');
  assert.equal(content.flows.find((f) => f.id === 'booking').status, 'partial');
  assert.equal(content.flows.find((f) => f.id === 'social-auth').status, 'deferred');
  assert.equal(content.releaseNote, 'Tests en cours.');
});
test('dated native rechecks remain modular and all their exact evidence paths are fingerprinted by the build', () => {
  for (const [name, record] of Object.entries(nativeRechecks)) assert.deepEqual(content[name], record);
  const paths = evidenceSourcePaths(content);
  for (const record of Object.values(nativeRechecks)) for (const file of [record.source, record.checksums]) assert(paths.includes(file));
  assert(source('scripts/build-partner-portal.mjs').includes('fingerprintEvidence(root, content)'));
  assert(source('partner-portal/content.mjs').split('\n').length < 300);
});

test('later public callback recovery does not promote older local payment evidence or attribute an unconfirmed cause', () => {
  const flow = content.flows.find(item => item.id === 'payments');
  const blocker = content.blockers.find(item => item.id === 'payment-return');
  assert.equal(flow.status, 'partial');
  assert.equal(flow.ui.source, 'docs/release/evidence/local-payment-layout-2026-10-18/results.json');
  assert.match(flow.remaining, /paiements réels sur téléphone/);
  assert.equal(blocker.source, 'docs/release/evidence/stripe-callback-recovery-2026-10-22/README.md');
  assert.match(blocker.next, /paiements réels/);
  assert(content.updates.some(item => item.flow === 'payments' && /cause reste à identifier/.test(item.text)));
  assert(content.updates.some(item => item.flow === 'payments' && /paiements réels restent à tester/.test(item.text)));
  assert.doesNotMatch(blocker.text, /facturation|suspension|Stripe|Firebase|HTTP|BrowserStack/i);
});

test('new phone consent keeps dated local application and restart evidence separate', () => {
  const flow = content.flows.find((item) => item.id === 'publication');
  const blocker = content.blockers.find((item) => item.id === 'trip-management');
  assert.equal(flow.status, 'partial');
  assert.match(flow.verified, /Deux parents acceptent séparément/);
  assert.match(blocker.next, /rejouer sur téléphone/);
  assert.match(blocker.next, /brouillons/);
  assert.equal(blocker.source, 'docs/release/evidence/real-maps-native-2026-10-18/README.md');
  assert.equal(flow.local.checkedAt, '2026-10-17'); assert.equal(flow.checkedAt, '2026-10-30');
  assert.equal(flow.scheduleDraftPhone.checkedAt, '2026-10-28'); assert.equal(flow.consentRestartPhone.checkedAt, '2026-10-28');
  assert.equal(flow.tripCancellationPhone.checkedAt, '2026-10-28'); assert.equal(flow.staleCancellationPhone.checkedAt, '2026-10-30');
  assert.equal(flow.ui.checkedAt, '2026-10-18');
  assert.equal(flow.tripConsentPhone.checkedAt, '2026-10-25');
  assert.equal(flow.tour.length, 10);
  assert(flow.tour.slice(0, 5).every(step => step.image.startsWith('cancel-stale-phone-')));
  assert(flow.tour.slice(5).every(step => step.image.startsWith('cancel-phone-')));
  assert(flow.images.some(image => image.file.startsWith('draft-phone-')));
  assert(flow.images.some(image => image.file.startsWith('consent-phone-')));
  assert(flow.ui.groups.includes('trip-consent-process-restart-ui'));
  assert.equal(flow.source, blocker.source);
  const current = Object.values(captures).filter((path) => path.includes('local-trip-consent-native-2026-10-17'));
  assert.equal(current.length, 4); assert(current.every((path) => path.includes('/completed/')));
});

test('older local results retain their own date when a newer app replay is added', () => {
  const flow = content.flows.find((item) => item.id === 'publication');
  assert.equal(validate(root), true);
  const original = flow.local.checkedAt;
  try { flow.local.checkedAt = '2026-10-18'; assert.throws(() => validate(root)); }
  finally { flow.local.checkedAt = original; }
  assert(source('partner-portal/src/render.js').includes('date(flow.local.checkedAt)'));
});

test('excerpts are bounded, original recordings retained and no audio exported', () => {
  assert(Object.keys(excerpts).length >= 4);
  for (const excerpt of Object.values(excerpts)) assert(excerpt.end - excerpt.start <= 30);
  const build = source('scripts/build-partner-portal.mjs');
  assert.match(build, /media\/\$\{name\}-full\.mp4/);
  assert.match(build, /'-an'/);
  assert.match(build, /evidenceFingerprints/);
  assert(!Object.values(assets).some((a) => /profile|options|staging-access|19-|20-|28-/.test(a.source)));
});

test('new form checks do not imply signup or completed participant flows', () => {
  const validation = content.flows.find((f) => f.id === 'auth-validation');
  assert.equal(validation.checkedAt, '2026-10-15');
  assert.equal(validation.images.length, 5);
  assert.match(validation.remaining, /n’a pas été retestée/);
  assert.equal(content.flows.find((f) => f.id === 'login').checkedAt, '2026-10-11');
  for (const id of ['booking', 'publication', 'clubs']) {
    assert.equal(content.flows.find((f) => f.id === id).status, 'partial');
  }
  assert.equal(content.flows.find((f) => f.id === 'payments').status, 'partial');
  assert(!content.blockers.some((b) => ['auth-landscape', 'calendar', 'search-empty'].includes(b.id)));
  assert.equal(content.flows.find((f) => f.id === 'appearance').status, 'partial');
  for (const name of ['login-empty', 'signup-name', 'signup-email', 'signup-password', 'signup-short', 'local-landscape']) assert(captures[name]);
  assert.match(source('scripts/build-partner-portal.mjs'), /Object.entries\(captures\)/);
});

test('portal has no production app hosting rewrite or client-side auth substitute', () => {
  const firebase = JSON.parse(source('firebase.json'));
  assert(!JSON.stringify(firebase.hosting).includes('partner-portal'));
  const html = source('partner-portal/src/index.html');
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /Espace privé|Suivi privé|signout-with-chatgpt|lock-keyhole/);
  assert.doesNotMatch(source('partner-portal/src/styles.css'), /\.access\s*\{|\.signout\s*\{/);
  assert(!html.includes('firebase'));
  const manifest = JSON.parse(source('partner-portal/.openai/hosting.json'));
  assert.equal(manifest.static.directory, 'dist');
  assert(!source('partner-portal/src/app.js').includes('localStorage'));
});

test('local results are backed by successful evidence and are not presented as phone recordings', async () => {
  const { localResults, detail, date } = await import('../partner-portal/src/render.js');
  const flows = content.flows.filter((flow) => flow.local);
  assert.equal(flows.length, 13);
  for (const flow of flows) {
    assert.equal(flow.status, 'partial');
    const currentPhone = flow.latestEvidence === 'phone' || (flow.latestEvidence !== 'local' && flow.phone && (flow.phone.checkedAt ?? flow.checkedAt) === flow.checkedAt);
    assert.match(detail(flow), currentPhone ? /Essai sur téléphone du/ : /Essai local du/);
    if (flow.phone) assert(localResults(flow).includes(`Essai local du ${date(flow.local.checkedAt || flow.checkedAt)}`));
    assert(localResults(flow).includes(flow.local.checks[0]));
    assert(!flow.recording);
  }
  assert.match(source('partner-portal/src/media.js'), /sans enregistrement sur téléphone/);
  assert.equal(content.flows.find((flow) => flow.id === 'tracking').status, 'partial');
});

test('manual screen evidence stays scoped and cannot complete a phone requirement', () => {
  const support = content.flows.find((flow) => flow.id === 'support');
  const original = support.ui;
  const originalLocal = support.local;
  const proof = JSON.parse(source(original.source));
  assert.equal(proof.method, 'manual-browser-ui');
  assert.equal(support.status, 'partial');
  assert(proof.steps.some((step) => step.id === 'admin-access-boundary-ui' && step.status === 'passed'));
  try {
    support.ui = { ...original, groups: ['invented-check'] };
    assert.throws(() => validate(root), /Unproven UI check/);
    support.ui = original;
    delete support.local;
    support.status = 'verified';
    assert.throws(() => validate(root), /Local UI checks do not complete/);
  } finally {
    support.ui = original;
    support.local = originalLocal;
    support.status = 'partial';
  }
});

test('app screenshots require a completed scoped run and retain product gaps', () => {
  const run = JSON.parse(source('docs/release/evidence/local-ui-2026-10-15/results.json'));
  assert.equal(run.testCount, 6);
  assert.equal(run.steps.length, 5);
  for (const id of ['navigation', 'appearance']) {
    const flow = content.flows.find((item) => item.id === id);
    assert.equal(flow.status, 'partial');
    assert.equal(flow.ui.source, 'docs/release/evidence/local-ui-2026-10-15/results.json');
  }
  for (const id of ['group-conversation', 'trip-management', 'contrast']) {
    assert(content.blockers.some((item) => item.id === id));
  }
  const group = content.blockers.find((item) => item.id === 'group-conversation');
  assert.match(group.text, /membres adultes d’une même équipe/);
  assert.match(group.text, /parents vérifiés/);
  assert.equal(content.flows.find((item) => item.id === 'team-conversation').status, 'partial');
  assert.match(group.next, /notifications.*échanges entre téléphones/);
  assert(content.flows.find(item => item.id === 'team-conversation').readPhone);
});

test('ride integrity claims use the new eleven-group evidence without promoting phone readiness', () => {
  const flow = content.flows.find((item) => item.id === 'ride-lifecycle');
  const run = JSON.parse(source(flow.local.source));
  assert.equal(run.steps.length, 11);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert(flow.local.groups.includes('ride-passenger-safety'));
  assert.equal(flow.status, 'partial');
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'partial');
});

test('message service claims use the refreshed 24-group evidence and retain history', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  const run = JSON.parse(source(flow.local.source));
  assert.equal(run.steps.length, 24);
  assert.equal(JSON.parse(source('docs/release/evidence/local-chat-response-loss-2026-10-16/results.json')).steps.length, 18);
  assert.equal(JSON.parse(source('docs/release/evidence/local-chat-directory-2026-10-15/results.json')).steps.length, 13);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert(flow.local.groups.includes('chat-delivery-safety'));
  assert(flow.local.groups.includes('chat-directory-safety'));
  assert(flow.local.groups.includes('chat-post-commit-response-loss'));
  assert(content.blockers.some((item) => item.id === 'account-switch-stability'));
  assert.equal(flow.status, 'partial');
  assert.equal(content.flows.find(item => item.id === 'team-conversation').status, 'partial');
  assert.match(flow.remaining, /clavier/);
  const baseline = JSON.parse(source('docs/release/evidence/local-chat-2026-10-15/baseline-failed.json'));
  assert.equal(baseline.steps.find((step) => step.id === 'chat-delivery-safety').status, 'failed');
});

test('search claims distinguish passing unit and simulated-screen evidence from real accounts', () => {
  const path = 'docs/release/evidence/local-search-state-2026-10-15/';
  for (const [file, count] of [['requests-passed.xml', 4], ['lifecycle-passed.xml', 6], ['safety-passed.xml', 5]]) {
    assert(source(path + file).includes(`tests="${count}" skipped="0" failures="0" errors="0"`));
  }
  assert(source(path + 'requests-baseline-failed.xml').includes('tests="4" skipped="0" failures="4" errors="0"'));
  const flow = content.flows.find((item) => item.id === 'search');
  assert.equal(flow.phone.source, 'docs/release/evidence/browserstack-parent-search-2026-10-18/results.json');
  assert.equal(flow.phone.checkedAt, '2026-10-18');
  assert.equal(flow.searchBookingUi.source, 'docs/release/evidence/parent-search-booking-native-2026-10-20/search-booking-results.json');
  assert.equal(flow.status, 'partial');
  assert.equal(flow.searchBookingPhone.checkedAt, '2026-10-24');
  assert.match(flow.remaining, /plusieurs trajets/);
  assert.match(flow.remaining, /coupures/);
  const run = JSON.parse(source(flow.ui.source));
  assert.equal(run.testCount, 14);
  assert.equal(run.steps.length, 15);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.equal(run.search.method, 'component-ui-with-explicit-fake-gateway');
  assert.match(run.search.limitation, /host identity\/navigation changes, not real provider matching/);
  assert(flow.ui.groups.includes('search-session-ui') && flow.ui.groups.includes('search-input-ui'));
  assert.equal(flow.images.filter(image => !image.file.startsWith('search-booking-') && !image.file.startsWith('search-phone-')).length, 8);
  assert.deepEqual(flow.images.slice(0, 3).map(image => image.file), ['search-phone-choices', 'search-phone-match', 'search-phone-requested']);
  assert(flow.images.some(image => image.file === 'search-booking-choices' && image.alt.includes('20 octobre')));
  assert.equal(flow.ui.checkedAt, '2026-10-16');
  assert(flow.images.some(image => /essai local simulé du 16 octobre/.test(image.alt)));
  assert(!Object.values(captures).some((path) => path.endsWith('local-search-edited-place.png')));
  assert(content.blockers.some((item) => item.id === 'account-switch-stability'));
});

test('current conversation evidence retains the full replay and the dated historical captures', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  const run = JSON.parse(source(flow.ui.source));
  assert.equal(run.testCount, 36);
  assert.equal(run.steps.length, 36);
  const previous = JSON.parse(source('docs/release/evidence/local-ui-collection-2026-10-16/accepted-run/results.json'));
  assert.equal(previous.testCount, 20); assert.equal(previous.steps.length, 21);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.deepEqual(flow.ui.groups, ['chat-conversation-ui', 'chat-directory-ui', 'chat-network-recovery-ui', 'chat-account-switch-ui', 'chat-confirmed-process-restart-ui', 'chat-post-commit-response-loss-ui']);
  assert.equal(run.chat.messageCount, 5);
  assert.equal(run.chat.newMessageCount, 4);
  assert.equal(run.chat.readNotificationCount, 4);
  assert.equal(run.chat.historyMessageCount, 120);
  assert.equal(run.directory.conversationCount, 28);
  assert.equal(run.directory.archivedConversationCount, 25);
  assert.equal(run.directory.firstPageCount, 20);
  assert.equal(run.directory.secondPageCount, 8);
  assert.equal(run.directory.messageCount, 2);
  assert.equal(run.directory.readNotificationCount, 2);
  assert.equal(flow.images.filter((image) => !['chat-restart-recheck-reply', 'chat-network-current-draft', 'chat-network-current-reply', 'chat-network-isolated-draft', 'chat-network-isolated-reply'].includes(image.file)).length, 11);
  assert.equal(JSON.parse(source('docs/release/evidence/local-chat-directory-ui-2026-10-15/results.json')).testCount, 9);
  assert.equal(JSON.parse(source('docs/release/evidence/local-chat-ui-2026-10-15/results.json')).testCount, 8);
  assert(!Object.values(captures).some((path) => /directory-(first-message|reply)\.png/.test(path)));
  assert.equal(flow.status, 'partial');
  assert.match(flow.remaining, /téléphones/);
  assert(!content.blockers.some((item) => item.id === 'chat-reply'));
  assert(!content.blockers.some((item) => item.id === 'chat-discovery'));
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'partial');
});

test('new ride captures use a completed seven-case UI run and keep old evidence intact', () => {
  const run = JSON.parse(source('docs/release/evidence/local-ride-ui-2026-10-15/results.json'));
  assert.equal(run.testCount, 7);
  assert.equal(run.steps.length, 8);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.equal(run.ride.bookingCount, 2);
  assert.equal(run.ride.auditEventCount, 4);
  assert.equal(run.ride.ratingCount, 1);
  for (const [id, group] of [['ride-lifecycle', 'ride-lifecycle-ui'], ['ratings', 'ride-review-ui'], ['impact', 'ride-ledgers-ui']]) {
    const flow = content.flows.find((item) => item.id === id);
    assert.equal(flow.ui.source, 'docs/release/evidence/local-ride-ui-2026-10-15/results.json');
    assert(flow.ui.groups.includes(group));
    assert.equal(flow.status, 'partial');
    assert.equal(flow.images.filter(image => !['ride-phone-', 'review-history-', 'received-rating-', 'review-page-', 'review-trip-', 'review-network-phone-', 'review-receipt-phone-', 'rating-accessible-', 'ledger-history-', 'profile-ledger-phone-'].some(prefix => image.file.startsWith(prefix))).length, 2);
    assert.equal(flow.images.filter(image => image.file.startsWith('ride-phone-')).length,
      id === 'ride-lifecycle' ? 6 : id === 'ratings' ? 2 : 0);
  }
  const old = JSON.parse(source('docs/release/evidence/local-ui-2026-10-15/results.json'));
  assert.equal(old.testCount, 6);
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'partial');
});

test('current native status keeps completed replay separate from both failed gates', () => {
  const report = validateNativeStatus(root, content.blockers);
  assert.equal(report.laterMainJobPassed,true);
  assert.equal(report.latestNativeJobPassed,false);assert.equal(report.latestScreenCasesPassed,166);
  assert.equal(report.replay.groups, 37); assert.equal(report.replay.cases, 40);
  assert.equal(report.ordinary.failed, 1); assert.equal(report.fullGatePassed, false);
  assert.equal(report.focusedScreenAssertionsCompleted, true); assert.equal(report.focusedPrimaryCopyPassed, false);
  assert.equal(report.rendererRootCauseFixed, false); assert.equal(report.physicalDeviceAccepted, false);
  assert.throws(() => validateNativeStatus(root, []));
  const old = structuredClone(content.blockers);
  old.find(row => row.id === 'native-evidence-copy').source = 'docs/release/evidence/tracking-observation-diagnostics-2026-10-25/README.md';
  assert.throws(() => validateNativeStatus(root, old));
});

import './partner-portal-ui.test.mjs';
