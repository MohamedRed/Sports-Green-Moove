import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const files = (portal) => readdirSync(resolve(portal, 'src')).sort();

export function assetRevision(portal) {
  const hash = createHash('sha256');
  for (const file of files(portal)) {
    hash.update(file).update('\0').update(readFileSync(resolve(portal, 'src', file)));
  }
  return hash.digest('hex').slice(0, 16);
}

export function versionedHtml(portal, revision) {
  return readFileSync(resolve(portal, 'src/index.html'), 'utf8')
    .replace('href="tokens.css"', `href="assets/${revision}/tokens.css"`)
    .replace('href="styles.css"', `href="assets/${revision}/styles.css"`)
    .replace('src="app.js"', `src="assets/${revision}/app.js"`);
}

export function buildBrowserAssets(root, portal, out) {
  const revision = assetRevision(portal);
  const bundle = resolve(out, 'assets', revision);
  mkdirSync(bundle, { recursive: true });
  for (const file of files(portal).filter((name) => name !== 'index.html')) {
    cpSync(resolve(portal, 'src', file), resolve(bundle, file));
  }
  cpSync(resolve(root, 'admin/public/fonts'), resolve(bundle, 'fonts'), { recursive: true });
  writeFileSync(resolve(out, 'index.html'), versionedHtml(portal, revision));
  return revision;
}

export function assertBrowserAssetsCurrent(portal, out) {
  const revision = assetRevision(portal);
  assert.equal(readFileSync(resolve(out, 'index.html'), 'utf8'), versionedHtml(portal, revision),
    'Page source changed after build; rebuild before publishing');
  for (const file of files(portal).filter((name) => name !== 'index.html')) {
    assert(readFileSync(resolve(portal, 'src', file)).equals(readFileSync(resolve(out, 'assets', revision, file))),
      `Browser source changed after build (${file}); rebuild before publishing`);
  }
}
