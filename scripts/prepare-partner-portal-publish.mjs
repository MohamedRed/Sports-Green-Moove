import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { content } from '../partner-portal/content.mjs';
import { assertBrowserAssetsCurrent, assetRevision } from '../partner-portal/build-assets.mjs';
import { assertMediaCurrent } from '../partner-portal/media-assets.mjs';
import {assertEvidenceArtifactsCommitted} from '../partner-portal/committed-evidence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portal = resolve(root, 'partner-portal');
const target = process.argv[2];
assert(target && target.startsWith('/'), 'Specify a separate absolute Sites checkout path');
const destination = resolve(target);
assert(!destination.startsWith(root), 'Do not nest a publishing repository in the app repository');
const manifest = JSON.parse(readFileSync(resolve(portal, '.openai/hosting.json'), 'utf8'));
if (existsSync(destination)) {
  const prior = JSON.parse(readFileSync(resolve(destination, '.openai/hosting.json'), 'utf8'));
  assert.equal(prior.project_id, manifest.project_id, 'Existing destination belongs to another Site');
}
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(dirty, '', 'Commit canonical source before preparing a release');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assertEvidenceArtifactsCommitted(root, content, commit);
assert(existsSync(resolve(portal, 'dist/data.json')), 'Build the portal first');
const built = JSON.parse(readFileSync(resolve(portal, 'dist/data.json'), 'utf8'));
const { evidenceFingerprints, assetRevision: builtRevision, mediaRevisions, ...snapshot } = built;
assert.deepEqual(snapshot, content, 'Content changed after build; rebuild before publishing');
assert.equal(builtRevision, assetRevision(portal), 'Browser bundle changed; rebuild before publishing');
assertBrowserAssetsCurrent(portal, resolve(portal, 'dist'));
assertMediaCurrent(resolve(portal, 'dist/media'), mediaRevisions);
for (const [source, fingerprint] of Object.entries(evidenceFingerprints)) {
  assert.equal(createHash('sha256').update(readFileSync(resolve(root, source))).digest('hex'), fingerprint,
    'Evidence source changed after build; review and rebuild before publishing');
}
mkdirSync(resolve(destination, '.openai'), { recursive: true });
cpSync(resolve(portal, '.openai/hosting.json'), resolve(destination, '.openai/hosting.json'));
// Only replace the generated static snapshot; never alter the Sites repository history.
rmSync(resolve(destination, 'dist'), { recursive: true, force: true });
cpSync(resolve(portal, 'dist'), resolve(destination, 'dist'), { recursive: true });
writeFileSync(resolve(destination, 'README.md'), `# Sports Green-Moove Progress\n\nStatic snapshot generated from canonical source commit ${commit}.\n\nCanonical source: https://github.com/MohamedRed/Sports-Green-Moove/tree/${commit}/partner-portal\n\nThe owner explicitly chose to keep this Site public on 23 October 2026. Preserve that audience. Publish reviewed synthetic captures only; raw diagnostics, credentials and private contact details are not part of this snapshot.\n`);
console.log(JSON.stringify({ checkout_path: destination, project_id: manifest.project_id, canonical_commit: commit }));
