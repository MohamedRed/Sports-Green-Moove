import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { content, assets, captures, videos, excerpts } from '../partner-portal/content.mjs';
import { validate } from '../partner-portal/validate.mjs';
import { buildBrowserAssets } from '../partner-portal/build-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portal = resolve(root, 'partner-portal');
const out = resolve(portal, 'dist');
validate(root);
rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, 'media'), { recursive: true });
const assetRevision = buildBrowserAssets(root, portal, out);
mkdirSync(resolve(out, 'icons'));
for (const name of ['play', 'x', 'search', 'arrow-up-right', 'chevron-left', 'chevron-right', 'download', 'image-off', 'lock-keyhole', 'log-out', 'info', 'leaf']) {
  cpSync(resolve(portal, `node_modules/lucide-static/icons/${name}.svg`), resolve(out, `icons/${name}.svg`));
}
for (const [name, source] of Object.entries(videos)) cpSync(resolve(root, source), resolve(out, `media/${name}-full.mp4`));
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'pipe' });
for (const [name, asset] of Object.entries(assets)) {
  ffmpeg('-i', resolve(root, 'docs/release/evidence/browserstack-2026-10-11', asset.source),
    '-vf', `crop=${asset.crop.join(':')}`, '-frames:v', '1', '-q:v', '3', resolve(out, `media/${name}.jpg`));
}
for (const [name, source] of Object.entries(captures)) {
  ffmpeg('-i', resolve(root, source), '-frames:v', '1', '-q:v', '3', resolve(out, `media/${name}.jpg`));
}
for (const [name, clip] of Object.entries(excerpts)) {
  const input = resolve(root, videos[clip.video]);
  ffmpeg('-ss', String(clip.start), '-i', input, '-t', String(clip.end - clip.start),
    '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', resolve(out, `media/${name}.mp4`));
  ffmpeg('-ss', String(clip.poster), '-i', input, '-frames:v', '1', '-q:v', '3', resolve(out, `media/${name}.jpg`));
}
for (const [name, video, at] of [['home', 'navigation', 10], ['signed-out', 'signout', 125]]) {
  ffmpeg('-ss', String(at), '-i', resolve(root, videos[video]), '-frames:v', '1', '-q:v', '3', resolve(out, `media/${name}.jpg`));
}
const fingerprints = Object.fromEntries([...new Set([content.nativeVerification.source, content.nativeVerification.manifest,
  content.nativeVerification.checksums, ...Object.values(content.nativeVerification.recheck),
  ...content.flows.flatMap((f) => [f.source, ...(f.local ? [f.local.source] : []), ...(f.ui ? [f.ui.source] : []), ...(f.mapUi ? [f.mapUi.source] : []), ...(f.phone ? [f.phone.source] : []), ...(f.historyPhone ? [f.historyPhone.source] : []), ...(f.searchBookingUi ? [f.searchBookingUi.source] : [])])])].map((source) => [source,
  createHash('sha256').update(readFileSync(resolve(root, source))).digest('hex')]));
for (const flow of content.flows) for (const record of [flow.attempt, flow.connected, flow.accessChanges, flow.accessAttempt, flow.nativeAccess, flow.draftAttempt, flow.draftRegression, flow.draftRestart, flow.draftErrorChecks, flow.draftErrorRecovery, flow.restorationRecheck, flow.restorationRecovery, flow.observationRecheck].filter(Boolean)) {
  fingerprints[record.source] = createHash('sha256').update(readFileSync(resolve(root, record.source))).digest('hex');
}
const data = { ...content, assetRevision, evidenceFingerprints: fingerprints };
writeFileSync(resolve(out, 'data.json'), `${JSON.stringify(data, null, 2)}\n`);
console.log(`Partner portal built: ${content.flows.length} flows, ${Object.keys(excerpts).length} short clips. No production app changes.`);
