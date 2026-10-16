import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { content, assets, captures, excerpts } from '../partner-portal/content.mjs';
import { validate } from '../partner-portal/validate.mjs';
import { assetRevision, buildBrowserAssets, assertBrowserAssetsCurrent } from '../partner-portal/build-assets.mjs';

const root = resolve(import.meta.dirname, '..');
const source = (file) => readFileSync(resolve(root, file), 'utf8');

test('every flow has truthful, dated evidence and explicit remaining scope', () => {
  assert.equal(validate(root), true);
  assert(content.flows.length >= 14);
  assert.equal(content.flows.find((f) => f.id === 'tracking').status, 'untested');
  assert.equal(content.flows.find((f) => f.id === 'booking').status, 'partial');
  assert.equal(content.flows.find((f) => f.id === 'social-auth').status, 'deferred');
  assert.equal(content.releaseNote, 'Tests en cours.');
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
  assert.equal(content.flows.find((f) => f.id === 'payments').status, 'blocked');
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
  assert.match(html, /signout-with-chatgpt\?return_to=/);
  assert(!html.includes('firebase'));
  const manifest = JSON.parse(source('partner-portal/.openai/hosting.json'));
  assert.equal(manifest.static.directory, 'dist');
  assert(!source('partner-portal/src/app.js').includes('localStorage'));
});

test('local results are backed by successful evidence and are not presented as phone recordings', async () => {
  const { localResults, detail } = await import('../partner-portal/src/render.js');
  const flows = content.flows.filter((flow) => flow.local);
  assert.equal(flows.length, 8);
  for (const flow of flows) {
    assert.equal(flow.status, 'partial');
    assert.match(detail(flow), /Essai local du/);
    assert(localResults(flow).includes(flow.local.checks[0]));
    assert(!flow.recording);
  }
  assert.match(source('partner-portal/src/media.js'), /sans enregistrement sur téléphone/);
  assert.equal(content.flows.find((flow) => flow.id === 'tracking').status, 'untested');
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
  assert.match(group.text, /membres d’une même équipe/);
  assert.match(group.text, /parents des enfants inscrits/);
  assert.match(group.text, /construire et à tester/);
});

test('ride integrity claims use the new eleven-group evidence without promoting phone readiness', () => {
  const flow = content.flows.find((item) => item.id === 'ride-lifecycle');
  const run = JSON.parse(source(flow.local.source));
  assert.equal(run.steps.length, 11);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert(flow.local.groups.includes('ride-passenger-safety'));
  assert.equal(flow.status, 'partial');
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
});

test('message service claims use the refreshed eighteen-group evidence and retain history', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  const run = JSON.parse(source(flow.local.source));
  assert.equal(run.steps.length, 18);
  assert.equal(JSON.parse(source('docs/release/evidence/local-chat-directory-2026-10-15/results.json')).steps.length, 13);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert(flow.local.groups.includes('chat-delivery-safety'));
  assert(flow.local.groups.includes('chat-directory-safety'));
  assert(flow.local.groups.includes('chat-post-commit-response-loss'));
  assert(content.blockers.some((item) => item.id === 'account-switch-stability'));
  assert.equal(flow.status, 'partial');
  assert.match(flow.remaining, /groupe/);
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
  assert.equal(flow.source, 'docs/release/evidence/local-search-options-ui-2026-10-16/README.md');
  assert.equal(flow.status, 'partial');
  assert.match(flow.remaining, /recherche complète/);
  assert.match(flow.remaining, /vraie déconnexion/);
  const run = JSON.parse(source(flow.ui.source));
  assert.equal(run.testCount, 14);
  assert.equal(run.steps.length, 15);
  assert(run.steps.every((step) => step.status === 'passed'));
  assert.equal(run.search.method, 'component-ui-with-explicit-fake-gateway');
  assert.match(run.search.limitation, /host identity\/navigation changes, not real provider matching/);
  assert(flow.ui.groups.includes('search-session-ui') && flow.ui.groups.includes('search-input-ui'));
  assert.equal(flow.images.length, 5);
  assert.match(flow.verified, /simulé/);
  assert(!Object.values(captures).some((path) => path.endsWith('local-search-edited-place.png')));
  assert(content.blockers.some((item) => item.id === 'account-switch-stability'));
});

test('conversation captures require the completed twenty-case run and keep phone scope open', () => {
  const flow = content.flows.find((item) => item.id === 'messages');
  const run = JSON.parse(source(flow.ui.source));
  assert.equal(run.testCount, 20);
  assert.equal(run.steps.length, 21);
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
  assert.equal(flow.images.length, 11);
  assert.equal(JSON.parse(source('docs/release/evidence/local-chat-directory-ui-2026-10-15/results.json')).testCount, 9);
  assert.equal(JSON.parse(source('docs/release/evidence/local-chat-ui-2026-10-15/results.json')).testCount, 8);
  assert(!Object.values(captures).some((path) => /directory-(first-message|reply)\.png/.test(path)));
  assert.equal(flow.status, 'partial');
  assert.match(flow.remaining, /téléphones/);
  assert(!content.blockers.some((item) => item.id === 'chat-reply'));
  assert(!content.blockers.some((item) => item.id === 'chat-discovery'));
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
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
    assert.equal(flow.images.length, 2);
  }
  const old = JSON.parse(source('docs/release/evidence/local-ui-2026-10-15/results.json'));
  assert.equal(old.testCount, 6);
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'untested');
});

test('smoke workflow covers portal source, evidence changes and validation', () => {
  const workflow = source('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"partner-portal/**"').length - 1, 2);
  assert.equal(workflow.split('"docs/release/evidence/**"').length - 1, 2);
  assert.match(workflow, /node --test tests\/partner-portal\.test\.mjs/);
});

test('rendered content is escaped and native accessible controls remain present', async () => {
  const { escape, overview, flowRows, detail } = await import('../partner-portal/src/render.js');
  assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.match(overview(content), /13 s/);
  assert.match(flowRows([]), /Aucun parcours/);
  assert.match(detail(content.flows[0]), /À faire/);
  assert.match(source('partner-portal/src/app.js'), /hashchange/);
  assert.match(source('partner-portal/src/media.js'), /oldVideo\?\.pause/);
});

test('portal code modules remain below 300 lines', () => {
  for (const file of ['content.mjs', 'evidence-captures.mjs', 'validate.mjs', 'build-assets.mjs', 'src/app.js', 'src/render.js', 'src/media.js', 'src/styles.css']) {
    assert(source(`partner-portal/${file}`).split('\n').length < 300, `${file} needs splitting`);
  }
});

test('frontend bundles are versioned together and stale generated source is rejected', () => {
  const portal = resolve(root, 'partner-portal');
  const out = mkdtempSync(resolve(tmpdir(), 'sgm-asset-test-'));
  try {
    const revision = buildBrowserAssets(root, portal, out);
    assert.equal(revision, assetRevision(portal));
    const html = readFileSync(resolve(out, 'index.html'), 'utf8');
    for (const file of ['tokens.css', 'styles.css', 'app.js']) assert(html.includes(`assets/${revision}/${file}`));
    assert(!html.includes('src="app.js"'));
    assertBrowserAssetsCurrent(portal, out);
    writeFileSync(resolve(out, 'assets', revision, 'render.js'), '// stale bundle');
    assert.throws(() => assertBrowserAssetsCurrent(portal, out), /Browser source changed/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('partner copy stays brief and recording context is optional', async () => {
  for (const flow of content.flows) {
    assert(flow.summary.length <= 100, `${flow.id}: shorten summary`);
    assert(flow.verified.length <= 200, `${flow.id}: shorten result`);
    assert(flow.remaining.length <= 240, `${flow.id}: shorten next steps`);
  }
  const { overview, detail, statuses } = await import('../partner-portal/src/render.js');
  assert.equal(statuses.verified, 'Testé');
  assert.equal(statuses.partial, 'Test partiel');
  assert(!overview(content).includes('release-note'));
  assert(!overview(content).includes('La suite'));
  assert.match(detail(content.flows.find((f) => f.id === 'signout')), /<details[^>]*><summary>Infos du test<\/summary>/);
  assert(!source('partner-portal/src/app.js').includes('validation globale'));
});

test('partner-facing pages do not name the implementation or testing stack', async () => {
  const { overview, flowRows, nextSteps, detail } = await import('../partner-portal/src/render.js');
  const html = [overview(content), flowRows(content.flows), nextSteps(content),
    ...content.flows.map(detail), source('partner-portal/src/index.html')].join('\n');
  assert.doesNotMatch(html, /\b(?:BrowserStack|Firebase|Radar|Stripe|Android|Pixel|staging|SDK|backend|callback|Google|Facebook)\b/i);
  assert.match(html, /alertes de position/);
  assert.match(html, /Connexion via un autre compte/);
});
