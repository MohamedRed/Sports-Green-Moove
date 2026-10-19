import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { assets, captures, videos, excerpts, content } from './content.mjs';
import { validatePhoneEvidence } from './phone-evidence.mjs';
import { validateHistoryPhoneArtifacts } from './team-history-phone-evidence.mjs';
import { validateTeamReviewReport } from '../scripts/qa/team-review-evidence.mjs';
import { validateRetainedTeamEnrollment } from '../scripts/qa/team-enrollment-retained-evidence.mjs';
import { validateRideEmergencyReport, validateRetainedRideEmergency } from '../scripts/qa/ride-emergency-retained-evidence.mjs';

export function validate(root) {
  const assertDate = (s) => assert.match(s, /^\d{4}-\d{2}-\d{2}$/);
  assertDate(content.updatedAt);
  assertDate(content.lastVerifiedAt);
  assert(content.lastVerifiedAt <= content.updatedAt);
  const statuses = ['verified', 'partial', 'blocked', 'untested', 'deferred'];
  const ids = new Set();
  for (const f of content.flows) {
    assert.match(f.id, /^[a-z][a-z0-9-]+$/);
    assert(!ids.has(f.id), `Duplicate flow ${f.id}`);
    ids.add(f.id);
    assert(statuses.includes(f.status));
    for (const field of ['title', 'summary', 'verified', 'remaining', 'source']) assert(f[field]?.trim());
    assert(existsSync(resolve(root, f.source)), `Missing source ${f.source}`);
    if (f.checkedAt) { assertDate(f.checkedAt); assert(f.checkedAt <= content.lastVerifiedAt); }
    if (f.status === 'verified') {
      assert(f.checkedAt);
      assert(f.images.length || f.clips?.length, `Verified flow ${f.id} needs evidence`);
    }
    for (const image of f.images) {
      assert(assets[image.file] || captures[image.file] || ['home', 'signed-out'].includes(image.file));
      assert(image.alt?.trim());
    }
    for (const clip of f.clips || []) assert(excerpts[clip]);
    if (f.recording) assert(videos[f.recording]);
    if (f.tour) {
      assert(f.tour.length >= 2, `Tour ${f.id} needs at least two evidence steps`);
      for (const step of f.tour) {
        assert(Boolean(step.image) !== Boolean(step.clip), 'Each step needs one evidence item');
        assert(step.image ? f.images.some((image) => image.file === step.image) : f.clips?.includes(step.clip),
          `Tour ${f.id} references evidence outside its flow`);
        assert(step.title?.trim() && step.text?.trim());
      }
    }
    if (f.local) {
      assert.equal(f.status, 'partial', 'Local service checks cannot complete a phone flow');
      const run = JSON.parse(readFileSync(resolve(root, f.local.source), 'utf8'));
      assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
      assert.equal(run.projectId, 'demo-sgm-local-qa');
      if (Object.hasOwn(f.local, 'checkedAt')) {
        assertDate(f.local.checkedAt); assert(f.local.checkedAt <= f.checkedAt);
        assert.equal(run.testedAt.slice(0, 10), f.local.checkedAt);
      } else assert.equal(run.testedAt.slice(0, 10), f.checkedAt);
      assert(f.local.groups.length && f.local.checks.length);
      for (const group of f.local.groups) assert(run.steps.some((s) => s.id === group && s.status === 'passed'), `Unproven local check ${group}`);
      for (const check of f.local.checks) assert(typeof check === 'string' && check.trim() && check.length <= 150);
    }
    if (f.ui) {
      assert.equal(f.status, 'partial', 'Local UI checks do not complete physical-device requirements');
      const run = JSON.parse(readFileSync(resolve(root, f.ui.source), 'utf8'));
      validateUiScope(run);
      if (f.id === 'team-enrollment') validateRetainedTeamEnrollment(root, f.ui.source);
      if (f.id === 'ride-emergency' || run.scope === 'local-active-ride-contact-with-sdk-and-dialer-not-physical') {
        assert.equal(f.id, 'ride-emergency'); validateRetainedRideEmergency(root, f.ui.source);
      }
      if (Object.hasOwn(f.ui, 'checkedAt')) {
        assertDate(f.ui.checkedAt); assert(f.ui.checkedAt <= f.checkedAt);
        assert.equal(run.testedAt.slice(0, 10), f.ui.checkedAt);
      } else assert.equal(run.testedAt.slice(0, 10), f.checkedAt);
      assert(f.ui.groups.length);
      for (const group of f.ui.groups) assert(run.steps.some((s) => s.id === group && s.status === 'passed'), `Unproven UI check ${group}`);
    }
    if (f.phone) {
      assert.equal(f.status, 'partial', 'A bounded phone flow does not complete every release requirement');
      validatePhoneEvidence(root, f.phone, f.checkedAt);
    }
    if (f.historyPhone) {
      assert.equal(f.status, 'partial');
      assert.equal(validateHistoryPhoneArtifacts(root, f.historyPhone.source).testedAt.slice(0, 10), f.checkedAt);
    }
  }
  for (const u of content.updates) { assertDate(u.date); assert(ids.has(u.flow)); assert(u.date <= content.updatedAt); }
  for (const b of content.blockers) assert(existsSync(resolve(root, b.source)));
  for (const a of Object.values(assets)) {
    assert(!a.source.includes('/') && a.source.endsWith('.jpg'));
    assert(a.crop.length === 4 && a.crop.every((v) => Number.isInteger(v) && v >= 0));
    assert(existsSync(resolve(root, 'docs/release/evidence/browserstack-2026-10-11', a.source)));
  }
  for (const source of Object.values(videos)) {
    const path = resolve(root, source);
    assert(path.startsWith(resolve(root, 'docs/release/evidence') + sep));
    assert(existsSync(path));
  }
  for (const clip of Object.values(excerpts)) {
    assert(videos[clip.video]);
    assert(clip.start >= 0 && clip.end > clip.start && clip.end - clip.start <= 30);
    assert(clip.poster >= clip.start && clip.poster <= clip.end);
  }
  const serialized = JSON.stringify(content);
  for (const [name, source] of Object.entries(captures)) {
    assert.match(name, /^[a-z][a-z0-9-]+$/);
    assert(!assets[name] && !excerpts[name] && !['home', 'signed-out'].includes(name));
    assert.match(source, /\.(png|jpg)$/);
    assert(resolve(root, source).startsWith(resolve(root, 'docs/release/evidence') + sep));
    assert(existsSync(resolve(root, source)), `Missing reviewed capture ${source}`);
  }
  assert(!/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(serialized), 'Do not publish email addresses');
  assert(!/AIza[\w-]{20,}|-----BEGIN .*PRIVATE KEY|Bearer\s+[\w.-]+/.test(serialized), 'Credential-like content');
  const manifest = JSON.parse(readFileSync(resolve(root, 'partner-portal/.openai/hosting.json'), 'utf8'));
  assert(manifest.project_id === 'appgprj_6acfa0036dac8191bd2792bbf88afaaf');
  assert(manifest.static.directory === 'dist');
  return true;
}

export function validateUiScope(run) {
  switch (run.scope) {
    case 'local-active-ride-contact-with-sdk-and-dialer-not-physical':
      validateRideEmergencyReport(run);
      break;
    case 'local-team-manager-review-not-physical-or-parent-native-ui':
      validateTeamReviewReport(run);
      break;
    case 'isolated-guardian-review-http-not-native-ui':
      assert.equal(run.projectId, 'demo-sgm-local-qa');
      assert.equal(run.productionWrites, false); assert.equal(run.physicalDevice, false);
      assert.equal(run.providerRequests, 0);
      assert.equal(run.browser?.scope, 'local-management-browser-not-native-or-physical');
      assert.equal(run.browser.externalRequests, 0); assert.equal(run.browser.productionWrites, false);
      assert.equal(run.browser.checks.length, 9);
      assert(run.browser.checks.every((check) => check.status === 'passed'));
      assert.equal(new Set(run.browser.checks.map((check) => check.id)).size, 9);
      break;
    case 'local-ui-not-physical-device':
      assert.equal(run.projectId, 'demo-sgm-local-qa');
      break;
    case 'local-native-component-ui-not-physical-device':
      assert.equal(run.projectId, null, 'Component fixtures do not connect to an application project');
      assert.equal(run.applicationBackendConnected, false);
      assert.equal(run.gateway, 'in-memory-fixture');
      assert.equal(run.fullAppReplay, false);
      assert.equal(run.physicalDevice, false);
      assert.equal(run.realProviderOutcomesVerified, false);
      assert.equal(run.componentSuiteCompleted, true);
      assert.equal(run.failures, 0); assert.equal(run.errors, 0); assert.equal(run.skipped, 0);
      assert(Number.isSafeInteger(run.testCount) && run.testCount > 0);
      assert.equal(run.steps.length, run.testCount);
      assert(run.steps.every((step) => step.status === 'passed'));
      assert.equal(new Set(run.steps.map((step) => step.id)).size, run.testCount);
      assert.match(run.sourceCommit, /^[a-f0-9]{40}$/);
      assert.match(run.sourceRun, /^https:\/\/github\.com\/MohamedRed\/Sports-Green-Moove\/actions\/runs\/\d+$/);
      break;
    default: assert.fail('Unknown UI evidence scope');
  }
}
