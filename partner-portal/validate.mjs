import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { assets, captures, videos, excerpts, content } from './content.mjs';
import { validatePhoneEvidence } from './phone-evidence.mjs';
import { validateBookingEvidence } from './booking-evidence.mjs';
import { validateSupportEvidence } from './support-evidence.mjs';
import { validateEmergencyDialerPreflight } from '../scripts/qa/emergency-phone-retained-evidence.mjs';
import { validateEmergencyDialerRecheck } from '../scripts/qa/emergency-dialer-recheck-evidence.mjs';
import { validateRetainedTeamConversation } from '../scripts/qa/team-conversation-retained-evidence.mjs';
import { validateRetainedTeamChatUi, teamChatComponentScope } from '../scripts/qa/team-chat-ui-evidence.mjs';
import { validateTeamConversationRecords } from './team-conversation-evidence.mjs';
import { validateSessionRestorationRecheck } from '../scripts/qa/session-restoration-recheck.mjs';
import { validateSessionRestorationRecovery } from '../scripts/qa/session-restoration-recovery.mjs';
import { validateHistoryPhoneArtifacts } from './team-history-phone-evidence.mjs';
import { validateRetainedTeamEnrollment } from '../scripts/qa/team-enrollment-retained-evidence.mjs';
import { validateRetainedRideEmergency } from '../scripts/qa/ride-emergency-retained-evidence.mjs';
import { validateRetainedRideObservation } from '../scripts/qa/ride-observation-retained-evidence.mjs';
import { validateRideObservationRecheck } from '../scripts/qa/ride-observation-recheck-evidence.mjs';
import { validateRetainedNativeStartup } from '../scripts/qa/native-startup-retained-evidence.mjs';
import { remoteRideStopScope, validateRetainedRemoteRideStop } from '../scripts/qa/remote-ride-stop-evidence.mjs';
import { validateRetainedVehicleMapServices } from '../scripts/qa/vehicle-map-evidence.mjs';
import { validateRetainedVehicleMapDisplay } from '../scripts/qa/vehicle-map-retained-evidence.mjs';
import { validateRetainedTeamClubIdentity } from '../scripts/qa/team-club-identity-evidence.mjs';
import { validateRetainedChildContactComponents } from '../scripts/qa/child-emergency-evidence.mjs';
import { validateRetainedEmergencyIdentity, emergencyIdentityScope } from '../scripts/qa/emergency-identity-retained-evidence.mjs';
import { validateIndependentNativeEvidence } from '../scripts/qa/independent-native-evidence.mjs';
import { validateNativeRecheck } from '../scripts/qa/native-recheck-evidence.mjs';
import { sessionRestorationScope, validateRetainedSessionRestoration } from '../scripts/qa/session-restoration-retained-evidence.mjs';
import { sessionDisconnectScope } from '../scripts/qa/session-disconnect-evidence.mjs';
import { validateRetainedSessionDisconnect } from '../scripts/qa/session-disconnect-retained-evidence.mjs';
import { validateCurrentNativeBlocker, validateFlowRecheck } from '../scripts/qa/flow-recheck-evidence.mjs';
import { validateProgressEntries } from './progress-validation.mjs';
import { validateNotificationSettingsPhone } from '../scripts/qa/notification-settings-phone-evidence.mjs';
import { validatePayoutAccountingEvidence } from '../scripts/qa/payout-accounting-evidence.mjs';
import { validateProfileCityEvidence } from '../scripts/qa/profile-city-evidence.mjs';
import { validateUiScope } from './ui-scope-validation.mjs';
export { validateUiScope } from './ui-scope-validation.mjs';

export function validate(root) {
  const assertDate = (s) => assert.match(s, /^\d{4}-\d{2}-\d{2}$/);
  assertDate(content.updatedAt);
  assertDate(content.lastVerifiedAt);
  assert(content.lastVerifiedAt <= content.updatedAt);
  validateFlowRecheck(root, content.flowRecheck);
  validateCurrentNativeBlocker(root, content);
  validatePayoutAccountingEvidence(root, content);
  const nativeDirectory = dirname(content.nativeVerification.manifest);
  assert(nativeDirectory.startsWith('docs/release/evidence/'));
  assert.equal(content.nativeVerification.source, nativeDirectory + '/README.md');
  assert.equal(content.nativeVerification.checksums, nativeDirectory + '/artifact-sha256.json');
  validateIndependentNativeEvidence(root, nativeDirectory);
  const recheck = content.nativeVerification.recheck, recheckDirectory = dirname(recheck.manifest);
  assert.equal(recheck.source, recheckDirectory + '/README.md');
  assert.equal(recheck.checksums, recheckDirectory + '/artifact-sha256.json');
  validateNativeRecheck(root, recheckDirectory);
  const currentMatrix = JSON.parse(readFileSync(resolve(root, nativeDirectory, 'replay/results.json')));
  assert.equal(currentMatrix.testedAt.slice(0, 10), content.nativeVerification.checkedAt);
  assert(content.nativeVerification.checkedAt <= content.lastVerifiedAt);
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
    validateBookingEvidence(root, f);
    if (f.id === 'profile-city') { assert.equal(f.status, 'partial'); validateProfileCityEvidence(root, f.profileCity); }
    if (f.id === 'notification-settings' || f.notificationPermissionPhone) validateNotificationSettingsPhone(root, f);
    if (f.local) {
      assert.equal(f.status, 'partial', 'Local service checks cannot complete a phone flow');
      const run = JSON.parse(readFileSync(resolve(root, f.local.source), 'utf8'));
      assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
      assert.equal(run.projectId, 'demo-sgm-local-qa');
      if (run.coverage === 'local-team-conversation-services-not-native-or-phone-ui')
        validateRetainedTeamConversation(root, f.local.source);
      if (f.local.groups.includes('vehicle-map-points')) validateRetainedVehicleMapServices(root, f.local.source);
      if (run.coverage === 'team-club-identity-not-chat-or-native-ui') validateRetainedTeamClubIdentity(root, f.local.source);
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
      if (f.id === 'team-conversation' || run.scope === teamChatComponentScope) {
        assert.equal(f.id, 'team-conversation'); validateRetainedTeamChatUi(root, f.ui.source);
        const folder = dirname(f.ui.source), review = JSON.parse(readFileSync(resolve(root, folder, 'visual-review.json')));
        assert.deepEqual(f.images.filter(image => Object.hasOwn(review.published, image.file)).map(image => image.file).sort(), Object.keys(review.published).sort());
        for (const [id, file] of Object.entries(review.published)) assert.equal(captures[id], folder + '/' + file);
      }
      if (f.id === 'session-disconnect' || run.scope === sessionDisconnectScope) {
        assert.equal(f.id, 'session-disconnect'); validateRetainedSessionDisconnect(root, f.ui.source);
      }
      if (f.id === 'session-restoration' || run.scope === sessionRestorationScope) {
        assert.equal(f.id, 'session-restoration'); validateRetainedSessionRestoration(root, f.ui.source);
      }
      if (f.id === 'emergency-profile' || run.scope === emergencyIdentityScope) {
        assert.equal(f.id, 'emergency-profile'); validateRetainedEmergencyIdentity(root, f.ui.source);
      }
      if (f.id === 'child-emergency' || run.scope === 'executed-local-child-contact-components-not-child-signin-or-dialer') {
        assert.equal(f.id, 'child-emergency'); validateRetainedChildContactComponents(root, f.ui.source);
      }
      if (f.id === 'team-enrollment') validateRetainedTeamEnrollment(root, f.ui.source);
      if (f.id === 'ride-emergency' || run.scope === 'local-active-ride-contact-with-sdk-and-dialer-not-physical') {
        assert.equal(f.id, 'ride-emergency'); validateRetainedRideEmergency(root, f.ui.source);
      }
      if (f.id === 'ride-observation' || run.scope === 'local-ride-live-sdk-not-physical-gps') {
        assert.equal(f.id, 'ride-observation'); validateRetainedRideObservation(root, f.ui.source);
      }
      if (f.id === 'native-startup' || run.scope === 'local-fused-mock-startup-not-physical-gps') {
        assert.equal(f.id, 'native-startup'); validateRetainedNativeStartup(root, f.ui.source);
      }
      if (f.id === 'remote-ride-stop' || run.scope === remoteRideStopScope) {
        assert.equal(f.id, 'remote-ride-stop'); validateRetainedRemoteRideStop(root, f.ui.source);
      }
      if (Object.hasOwn(f.ui, 'checkedAt')) {
        assertDate(f.ui.checkedAt); assert(f.ui.checkedAt <= f.checkedAt);
        assert.equal(run.testedAt.slice(0, 10), f.ui.checkedAt);
      } else assert.equal(run.testedAt.slice(0, 10), f.checkedAt);
      assert(f.ui.groups.length);
      for (const group of f.ui.groups) assert(run.steps.some((s) => s.id === group && s.status === 'passed'), `Unproven UI check ${group}`);
    }
    if (f.observationRecheck) {
      assert.equal(f.id, 'ride-observation'); assert.equal(f.status, 'partial');
      const source = f.observationRecheck.source, run = validateRideObservationRecheck(root, source);
      assert.equal(run.testedAt.slice(0, 10), f.checkedAt);
      assert.deepEqual(f.images.filter(image => image.file.startsWith('ride-recheck-')).map(image => image.file).sort(),
        Object.keys(run.publishedCaptures).sort());
      for (const [id, file] of Object.entries(run.publishedCaptures)) assert.equal(captures[id], dirname(source) + '/' + file);
    }
    if (f.mapUi) {
      assert.equal(f.id, 'ride-observation'); assert.equal(f.status, 'partial');
      assert(resolve(root, f.mapUi.source).startsWith(resolve(root, 'docs/release/evidence') + sep));
      const report = validateRetainedVehicleMapDisplay(root, f.mapUi.source);
      const date = f.mapUi.checkedAt ?? f.checkedAt; assertDate(date); assert(date <= f.checkedAt);
      assert.equal(report.testedAt.slice(0, 10), date);
      assert.deepEqual(f.mapUi.images, ['vehicle-map-first', 'vehicle-map-moved']);
      for (const [index, id] of f.mapUi.images.entries()) {
        assert(f.images.some((image) => image.file === id));
        assert.equal(resolve(root, captures[id]), resolve(root, f.mapUi.source, '..', report.displays[index].screenFile));
      }
    }
    validateSupportEvidence(root, f, captures);
    if (f.phone) {
      assert.equal(f.status, 'partial', 'A bounded phone flow does not complete every release requirement');
      const date = f.phone.checkedAt ?? f.checkedAt;
      assertDate(date); assert(date <= f.checkedAt);
      validatePhoneEvidence(root, f.phone, date);
    }
    if (f.dialerPreflight) {
      assert.equal(f.id, 'emergency-contact'); assert.equal(f.status, 'partial');
      const run = validateEmergencyDialerPreflight(root, f.dialerPreflight.source);
      assert.equal(run.recordedAt.slice(0, 10), f.checkedAt);
    }
    if (f.dialerPreflightRecheck) {
      assert.equal(f.id, 'emergency-contact'); assert.equal(f.status, 'partial');
      validateEmergencyDialerRecheck(root, f.dialerPreflightRecheck);
    }
    validateTeamConversationRecords(root, f, captures);
    if (f.restorationRecheck) {
      assert.equal(f.id, 'session-restoration'); assert.equal(f.status, 'partial');
      assert.equal(validateSessionRestorationRecheck(root, f.restorationRecheck.source).testedAt.slice(0, 10), f.checkedAt);
    }
    if (f.restorationRecovery) {
      assert.equal(f.id, 'session-restoration'); assert.equal(f.status, 'partial');
      const run = validateSessionRestorationRecovery(root, f.restorationRecovery.source);
      assert.equal(run.testedAt.slice(0, 10), f.checkedAt);
      assert.deepEqual(f.images.filter(image => image.file.startsWith('session-recheck-')).map(image => image.file).sort(), Object.keys(run.publishedCaptures).sort());
      for (const [id, file] of Object.entries(run.publishedCaptures)) assert.equal(captures[id], dirname(f.restorationRecovery.source) + '/' + file);
    }
    if (f.historyPhone) {
      assert.equal(f.status, 'partial');
      assert.equal(validateHistoryPhoneArtifacts(root, f.historyPhone.source).testedAt.slice(0, 10), f.checkedAt);
    }
  }
  validateProgressEntries(root, content, ids);
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
