import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { content, assets, captures, excerpts } from '../partner-portal/content.mjs';
import { validate } from '../partner-portal/validate.mjs';
import { assetRevision, buildBrowserAssets, assertBrowserAssetsCurrent } from '../partner-portal/build-assets.mjs';
import { fingerprintMedia, assertMediaCurrent } from '../partner-portal/media-assets.mjs';
import { configureMediaRevisions, mediaUrl } from '../partner-portal/src/media-url.js';

const root = resolve(import.meta.dirname, '..');
const source = (file) => readFileSync(resolve(root, file), 'utf8');
const previewRevisions = Object.fromEntries(content.flows.flatMap(flow => [
  ...flow.images.map(image => image.file), ...(flow.clips || []),
]).map(file => [file + '.jpg', 'a'.repeat(64)]));

test('media addresses are content-addressed and missing or unsafe manifest entries fail closed', () => {
  assert.throws(() => mediaUrl('capture.jpg'));
  for (const manifest of [null, [], {}, { '../capture.jpg': 'a'.repeat(64) }, { 'capture.jpg': 'invalid' }])
    assert.throws(() => configureMediaRevisions(manifest));
  configureMediaRevisions({ 'capture.jpg': 'a'.repeat(64), 'clip.mp4': 'b'.repeat(64) });
  assert.equal(mediaUrl('capture.jpg'), 'media/capture.jpg?v=' + 'a'.repeat(64));
  assert.equal(mediaUrl('clip.mp4'), 'media/clip.mp4?v=' + 'b'.repeat(64));
  assert.throws(() => mediaUrl('missing.jpg'));
  configureMediaRevisions({ 'capture.jpg': 'c'.repeat(64) });
  assert.equal(mediaUrl('capture.jpg'), 'media/capture.jpg?v=' + 'c'.repeat(64));
  assert.throws(() => mediaUrl('clip.mp4'));
});

test('media fingerprints cover actual bytes and publication rejects changed or missing output', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-media-test-'));
  try {
    writeFileSync(resolve(directory, 'capture.jpg'), 'original-image-test-bytes');
    writeFileSync(resolve(directory, 'clip.mp4'), 'original-video-test-bytes');
    const manifest = fingerprintMedia(directory); assertMediaCurrent(directory, manifest);
    writeFileSync(resolve(directory, 'capture.jpg'), 'changed-image-test-bytes');
    assert.notEqual(fingerprintMedia(directory)['capture.jpg'], manifest['capture.jpg']);
    assert.throws(() => assertMediaCurrent(directory, manifest));
    rmSync(resolve(directory, 'clip.mp4')); assert.throws(() => assertMediaCurrent(directory, manifest));
    writeFileSync(resolve(directory, 'unreviewed.txt'), 'unexpected'); assert.throws(() => fingerprintMedia(directory));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('previews, gallery, tours, posters and downloads all use the same versioned media resolver', () => {
  for (const name of ['visuals.js', 'media.js', 'tour.js']) {
    const value = source('partner-portal/src/' + name);
    assert(value.includes("from './media-url.js'")); assert(!value.includes('media/${'));
  }
  const app = source('partner-portal/src/app.js');
  assert(app.indexOf('configureMediaRevisions(data.mediaRevisions)') < app.indexOf('overview(data)'));
  assert(source('scripts/prepare-partner-portal-publish.mjs').includes('assertMediaCurrent'));
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
  assert.doesNotMatch(overview(content), /data-flow=|<video|class="flow-preview"/);
  assert.match(flowRows([]), /Aucun parcours/);
  assert.match(detail(content.flows[0]), /À faire/);
  assert.match(source('partner-portal/src/app.js'), /hashchange/);
  assert.match(source('partner-portal/src/media.js'), /oldVideo\?\.pause/);
});

test('portal code modules remain below 300 lines', () => {
  for (const file of ['content.mjs', 'evidence-captures.mjs', 'validate.mjs', 'booking-evidence.mjs', 'build-assets.mjs', 'src/app.js', 'src/render.js', 'src/media.js', 'src/styles.css', 'tours.mjs', 'src/tour.js', 'src/visuals.js', 'src/visuals.css', 'src/ui.js']) {
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
  configureMediaRevisions(previewRevisions);
  const { overview, flowRows, nextSteps, detail } = await import('../partner-portal/src/render.js');
  const html = [overview(content), flowRows(content.flows), nextSteps(content),
    ...content.flows.map(detail), source('partner-portal/src/index.html')].join('\n');
  assert.doesNotMatch(html, /\b(?:BrowserStack|Firebase|Radar|Stripe|Android|Pixel|staging|SDK|backend|callback|Google|Facebook)\b/i);
  assert.match(html, /alertes de position/);
  assert.match(html, /Connexion via un autre compte/);
});

test('guided tours reference reviewed flow evidence and reject invented steps', () => {
  assert(content.flows.filter((flow) => flow.tour).length >= 10);
  const flow = content.flows.find((item) => item.id === 'booking');
  const original = flow.tour[0].image;
  try {
    flow.tour[0].image = 'unreviewed-capture';
    assert.throws(() => validate(root), /evidence outside its flow/);
  } finally { flow.tour[0].image = original; }
  assert.equal(validate(root), true);
});

test('overview stays focused while the catalogue exposes every tour and screenshot', async () => {
  configureMediaRevisions(previewRevisions);
  const { overview, flowRows } = await import('../partner-portal/src/render.js');
  const html = flowRows(content.flows);
  assert.equal((html.match(/data-tour="true"/g) || []).length, content.flows.filter((flow) => flow.tour).length);
  assert.match(overview(content), /Voir les nouvelles précédentes/);
  for (const flow of content.flows.filter((item) => item.images.length)) {
    assert.match(flowRows([flow]), /class="flow-preview"/);
    assert.match(flowRows([flow]), /loading="lazy"/);
  }
  const workflow = source('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/partner-portal-ui.test.mjs"').length - 1, 2);
});

test('overview selects the newest result per flow without losing previous results', async () => {
  const { partitionUpdates, overview } = await import('../partner-portal/src/render.js');
  const entry = (flow, title) => Object.freeze({ flow, title, date: '2026-10-18', text: title });
  const updates = Object.freeze([
    entry('publication', 'Latest run passed'),
    entry('publication', 'Earlier run interrupted'),
    entry('payments', 'Payment review captured'),
    entry('publication', 'Oldest run interrupted'),
    entry('clubs', 'Parent verification checked'),
  ]);
  const { recent, previous } = partitionUpdates(updates);
  assert.deepEqual(recent, [updates[0], updates[2], updates[4]]);
  assert.deepEqual(previous, [updates[1], updates[3]]);
  assert.equal(new Set([...recent, ...previous]).size, updates.length);
  const html = overview({ ...content, updates });
  const [visible, history] = html.split('<details class="previous-updates">');
  assert.match(visible, /Latest run passed/);
  assert.doesNotMatch(visible, /Earlier run interrupted|Oldest run interrupted/);
  assert.match(history, /Earlier run interrupted/);
  assert.match(history, /Oldest run interrupted/);
});

test('update partition handles empty, repeated and more than six distinct flows', async () => {
  const { partitionUpdates, overview } = await import('../partner-portal/src/render.js');
  assert.deepEqual(partitionUpdates([]), { recent: [], previous: [] });
  assert(!overview({ ...content, updates: [] }).includes('previous-updates'));
  const repeated = Array.from({ length: 4 }, (_, i) => ({ flow: 'publication', title: `${i}` }));
  assert.deepEqual(partitionUpdates(repeated), { recent: repeated.slice(0, 1), previous: repeated.slice(1) });
  const distinct = Array.from({ length: 8 }, (_, i) => ({ flow: `flow-${i}` }));
  assert.deepEqual(partitionUpdates(distinct), { recent: distinct.slice(0, 6), previous: distinct.slice(6) });
  const { recent, previous } = partitionUpdates(content.updates);
  assert.equal(new Set(recent.map((entry) => entry.flow)).size, recent.length);
  assert.equal(recent.length + previous.length, content.updates.length);
  for (const entry of recent) assert.equal(content.updates.find((u) => u.flow === entry.flow), entry);
});
