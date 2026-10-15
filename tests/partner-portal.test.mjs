import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { content, assets, excerpts } from '../partner-portal/content.mjs';
import { validate } from '../partner-portal/validate.mjs';
import { assetRevision, buildBrowserAssets, assertBrowserAssetsCurrent } from '../partner-portal/build-assets.mjs';

const root = resolve(import.meta.dirname, '..');
const source = (file) => readFileSync(resolve(root, file), 'utf8');

test('every flow has truthful, dated evidence and explicit remaining scope', () => {
  assert.equal(validate(root), true);
  assert(content.flows.length >= 14);
  assert.equal(content.flows.find((f) => f.id === 'tracking').status, 'untested');
  assert.equal(content.flows.find((f) => f.id === 'booking').status, 'blocked');
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
  for (const file of ['content.mjs', 'validate.mjs', 'build-assets.mjs', 'src/app.js', 'src/render.js', 'src/media.js', 'src/styles.css']) {
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
