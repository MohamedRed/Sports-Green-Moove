import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { content, assets, excerpts } from '../partner-portal/content.mjs';
import { validate } from '../partner-portal/validate.mjs';

const root = resolve(import.meta.dirname, '..');
const source = (file) => readFileSync(resolve(root, file), 'utf8');

test('every flow has truthful, dated evidence and explicit remaining scope', () => {
  assert.equal(validate(root), true);
  assert(content.flows.length >= 14);
  assert.equal(content.flows.find((f) => f.id === 'tracking').status, 'untested');
  assert.equal(content.flows.find((f) => f.id === 'booking').status, 'blocked');
  assert.equal(content.flows.find((f) => f.id === 'social-auth').status, 'deferred');
  assert.match(content.releaseNote, /pas encore validée/);
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
  assert.match(detail(content.flows[0]), /Ce qui reste à prouver/);
  assert.match(source('partner-portal/src/app.js'), /hashchange/);
  assert.match(source('partner-portal/src/media.js'), /oldVideo\?\.pause/);
});

test('portal code modules remain below 300 lines', () => {
  for (const file of ['content.mjs', 'validate.mjs', 'src/app.js', 'src/render.js', 'src/media.js', 'src/styles.css']) {
    assert(source(`partner-portal/${file}`).split('\n').length < 300, `${file} needs splitting`);
  }
});
