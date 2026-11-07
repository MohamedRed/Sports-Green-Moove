import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';
import { fileURLToPath } from 'node:url';
import { validateFlowCheckRecoveryEvidence } from '../scripts/qa/flow-check-recovery-evidence.mjs';
import { childPhoneStartupAttempt } from '../partner-portal/progress-2026-10-26.mjs';

const file = new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url);
const workflow = parseDocument(readFileSync(file, 'utf8')).toJSON();
const setup = new Set(['Install dependencies', 'Build Functions', 'Install media inspection tools']);
const smokeGroups = ['smoke', 'people-safety', 'guardian-safety'];

test('original terminal CI outcomes and the zero-checkpoint phone attempt remain incomplete', () => {
  validateFlowCheckRecoveryEvidence(fileURLToPath(new URL('..', import.meta.url)), childPhoneStartupAttempt);
});

test('all 111 original workload steps retain their exact commands, environments, IDs and multiplicity', () => {
  const rows = smokeGroups.flatMap(key => workflow.jobs[key].steps)
    .filter(step => step.run && !setup.has(step.name) && step.name !== 'Validate complete smoke partitioning' &&
      step.name !== 'Test child contact discovery through verified-parent approval')
    .filter(step => step.name !== 'Test primary capture observation protocol')
    .filter(step => step.name !== 'Test team alerts and pending phone delivery')
    .filter(step => step.name !== 'Test foreground notification inbox authority')
    .filter(step => step.name !== 'Test current-device team alert resolution')
    .filter(step => step.name !== 'Test durable team push dispatch without provider sends')
    .filter(step => step.name !== 'Validate failed notification capture and unchanged quality gate')
    .filter(step => step.name !== 'Validate physical draft and consent evidence boundaries')
    .filter(step => step.name !== 'Validate partial team connection recovery evidence')
    .filter(step => step.name !== 'Validate seven physical team process restarts')
    .filter(step => step.name !== 'Validate direct booking confirmation and phone restart')
    .filter(step => step.name !== 'Test isolated booking reply-loss guards')
    .filter(step => step.name !== 'Test private Android network validation history')
    .filter(step => step.name !== 'Test runtime compressed request parsing and size limits')
    .filter(step => step.name !== 'Verify committed publication artifacts')
    .filter(step => step.name !== 'Validate isolated network recovery recheck without promoting physical readiness')
    .filter(step => step.name !== 'Validate full native gate and published media evidence boundaries')
    .filter(step => step.name !== 'Test completed review history beyond the legacy limit')
    .filter(step => step.name !== 'Test private received rating summaries')
    .filter(step => step.name !== 'Test pending review pagination across completed ride history')
    .filter(step => step.name !== 'Test authenticated pending review trip context')
    .filter(step => step.name !== 'Test immutable rating retries after connection loss')
    .filter(step => step.name !== 'Validate physical trip cancellation evidence and observer boundaries')
    .filter(step => step.name !== 'Test parent-shared child invitations without adult-role signup')
    .filter(step => step.name !== 'Test child booking receipt recovery without map requests')
    .filter(step => step.name !== 'Validate private input and stale cancellation phone evidence')
    .filter(step => step.name !== 'Validate hosted Android disk capacity guard')
    .filter(step => step.name !== 'Validate role-specific accent controls and phone evidence')
    .filter(step => step.name !== 'Test custom TLS certificate verification and retained scope')
    .filter(step => step.name !== 'Test premature response compression cleanup')
    .filter(step => step.name !== 'Validate native search departure controls and blocked phone evidence')
    .filter(step => step.name !== 'Validate physical calendar retry and latest native copy evidence')
    .filter(step => step.name !== 'Validate controlled chat phone records and evidence')
    .filter(step => step.name !== 'Validate chat account-switch checkpoints')
    .filter(step => step.name !== 'Test bound emulator transfer observations')
    .filter(step => step.name !== 'Test explicit diagnostic toolchain selection')
    .filter(step => step.name !== 'Test post-commit chat confirmation loss guards')
    .filter(step => step.name !== 'Test isolated chat proof diagnostic')
    .filter(step => step.name !== 'Test approved invitation private alias')
    .filter(step => step.name !== 'Validate paired native network preparation observations')
    .filter(step => step.name !== 'Validate complete native pass without release promotion')
    .filter(step => step.name !== 'Test approved temporary network startup logging')
    .filter(step => step.name !== 'Test approved invitation same-origin transport')
    .filter(step => step.name !== 'Test invitation-bound phone approval observations')
    .filter(step => step.name !== 'Test readable status feedback and error colours')
    .filter(step => step.name !== 'Test complete booking dates in enlarged native layouts')
    .filter(step => step.name !== 'Validate bounded public-repository iPhone verification')
    .filter(step => step.name !== 'Validate bounded node readiness and retained failure scope')
    .filter(step => step.name !== 'Validate iPhone emergency contact ownership and evidence scope')
    .map(step => JSON.stringify(step)).sort();
  // Semantic workload fingerprint captured from pushed pre-split source 82662bd.
  assert.equal(rows.length, 111);
  assert.deepEqual(workflow.jobs.smoke.steps.filter(step => step.name === 'Test complete booking dates in enlarged native layouts'),
    [{name: 'Test complete booking dates in enlarged native layouts', run: 'node --test tests/booking-date-layout.test.mjs'}]);
  const teamAlerts = workflow.jobs['people-safety'].steps.filter(step => step.name === 'Test team alerts and pending phone delivery');
  assert.equal(teamAlerts.length, 1);
  assert.equal(teamAlerts[0].run, 'npm run test:team-alerts && node --test tests/team-alerts-contract.test.mjs && SGM_LOCAL_FLOW_OUTPUT=${{ runner.temp }}/team-push-registration-services.json npm run test:team-push-registration && node --test tests/team-push-registration-contract.test.mjs tests/team-push-registration-evidence.test.mjs tests/team-push-native-journal.test.mjs tests/team-push-lifecycle.test.mjs tests/team-push-native-gate.test.mjs tests/team-push-signout-contract.test.mjs tests/team-push-signout-connected.test.mjs tests/team-push-exit-components.test.mjs');
  assert.equal(teamAlerts[0].env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/team-alerts-services.json');
  const notificationInbox = workflow.jobs['people-safety'].steps.filter(step => step.name === 'Test foreground notification inbox authority');
  assert.equal(notificationInbox.length, 1);
  assert.equal(notificationInbox[0].run, 'npm run test:notification-inbox && node --test tests/notification-inbox-contract.test.mjs tests/notification-inbox-phone-checkpoints.test.mjs tests/notification-inbox-evidence.test.mjs tests/notification-retry-phone-checkpoints.test.mjs tests/notification-retry-phone-evidence.test.mjs');
  assert.equal(notificationInbox[0].env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/notification-inbox-services.json');
  const compression = workflow.jobs.smoke.steps.filter(step => step.name === 'Test premature response compression cleanup');
  assert.equal(compression.length, 1);
  assert.equal(compression[0].run, 'node --test tests/compression-close-security.test.mjs tests/compression-close-security-evidence.test.mjs');
  const transport = workflow.jobs.smoke.steps.filter(step => step.name === 'Test bound emulator transfer observations');
  assert.equal(transport.length, 1);
  assert.equal(transport[0].run, 'node --test tests/adb-transfer-probe.test.mjs tests/adb-transfer-guest.test.mjs tests/adb-transfer-emulator.test.mjs');
  const complete = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate complete native pass without release promotion');
  assert.equal(complete.length, 1); assert.equal(complete[0].run, 'node --test tests/native-full-gate-pass.test.mjs');
  const chatPhone = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate controlled chat phone records and evidence');
  assert.equal(chatPhone.length, 1);
  assert.equal(chatPhone[0].run, 'node --test tests/chat-network-phone-checkpoints.test.mjs tests/chat-network-phone-evidence.test.mjs tests/chat-pending-restart-checkpoints.test.mjs tests/chat-pending-restart-phone.test.mjs');
  const accountSwitch = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate chat account-switch checkpoints');
  assert.equal(accountSwitch.length, 1); assert.equal(accountSwitch[0].run, 'node --test tests/chat-account-switch-checkpoints.test.mjs tests/chat-account-switch-phone.test.mjs');
  const phoneRetry = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate physical calendar retry and latest native copy evidence');
  assert.equal(phoneRetry.length, 1);
  assert.equal(phoneRetry[0].run, 'node --test tests/search-departure-phone.test.mjs tests/search-departure-ci.test.mjs');
  const departure = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate native search departure controls and blocked phone evidence');
  assert.equal(departure.length, 1); assert.equal(departure[0].run, 'node --test tests/search-departure-contract.test.mjs tests/search-departure-evidence.test.mjs');
  const tls = workflow.jobs.smoke.steps.filter(step => step.name === 'Test custom TLS certificate verification and retained scope');
  assert.equal(tls.length, 1); assert.equal(tls[0].run, 'node --test tests/tls-agent-security.test.mjs tests/tls-agent-evidence.test.mjs');
  const accent = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate role-specific accent controls and phone evidence');
  assert.equal(accent.length, 1); assert.equal(accent[0].run, 'node --test tests/accent-controls.test.mjs');
  const disk = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate hosted Android disk capacity guard');
  assert.equal(disk.length, 1); assert.equal(disk[0].run, 'node --test tests/hosted-android-disk.test.mjs tests/preparation-failure-evidence.test.mjs');
  const privatePhone = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate private input and stale cancellation phone evidence');
  assert.equal(privatePhone.length, 1);
  assert.equal(privatePhone[0].run, 'node --test tests/private-credential-form.test.mjs tests/cancellation-stale-phone.test.mjs');
  const cancellation = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate physical trip cancellation evidence and observer boundaries');
  assert.equal(cancellation.length, 1);
  assert.equal(cancellation[0].run, 'node --test tests/trip-cancellation-phone-checkpoints.test.mjs tests/trip-cancellation-phone-evidence.test.mjs');
  assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    '9cd670feeb2b0fa303212bd460b0f647499dac6264ad0830468354575dcbb1a2');
  const added = workflow.jobs['guardian-safety'].steps.filter(step => step.name === 'Test child contact discovery through verified-parent approval');
  assert.equal(added.length, 1);
  assert.equal(added[0].run, 'npm run test:child-account-approval && node --test tests/child-contact-discovery.test.mjs');
  assert.equal(added[0].env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/child-contact-discovery.json');
  const capture = workflow.jobs.smoke.steps.filter(step => step.name === 'Test primary capture observation protocol');
  assert.equal(capture.length, 1); assert.equal(capture[0].run, 'node --test tests/primary-capture-diagnostics.test.mjs tests/primary-capture-late-samples.test.mjs tests/rejected-primary-captures.test.mjs tests/capture-window-calibration.test.mjs');
  const invitation = workflow.jobs['guardian-safety'].steps.filter(step => step.name === 'Test parent-shared child invitations without adult-role signup');
  assert.equal(invitation.length, 1);
  assert.equal(invitation[0].run, 'npm run test:child-invitation && node --test tests/child-invitation-contract.test.mjs');
  const childBooking = workflow.jobs['guardian-safety'].steps.filter(step => step.name === 'Test child booking receipt recovery without map requests');
  assert.equal(childBooking.length, 1);
  assert.equal(childBooking[0].run, 'node scripts/qa/run-local-child-booking-receipt.mjs && node --test tests/booking-receipt-loss-proxy.test.mjs');
  assert.equal(childBooking[0].env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/child-booking-receipt.json');
  const schedule = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate physical draft and consent evidence boundaries');
  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].run, 'node --test tests/schedule-draft-phone-evidence.test.mjs tests/trip-consent-restart-phone-evidence.test.mjs');
  const recovery = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate partial team connection recovery evidence');
  assert.equal(recovery.length, 1);
  assert.equal(recovery[0].run, 'node --test tests/team-connection-recovery-evidence.test.mjs');
  const restarts = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate seven physical team process restarts');
  assert.equal(restarts.length, 1);
  assert.equal(restarts[0].run, 'node --test tests/team-process-restart-phone-evidence.test.mjs');
  const direct = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate direct booking confirmation and phone restart');
  assert.equal(direct.length, 1); assert.equal(direct[0].run, 'node --test tests/direct-booking-evidence.test.mjs');
  const parser = workflow.jobs.smoke.steps.filter(step => step.name === 'Test runtime compressed request parsing and size limits');
  assert.equal(parser.length, 1);
  assert.equal(parser[0].run, 'node --test tests/http-body-parser-security.test.mjs tests/http-body-parser-evidence.test.mjs tests/local-runtime-disposal.test.mjs tests/dependency-security-contract.test.mjs tests/dependency-patch-evidence.test.mjs tests/test-runner-security-contract.test.mjs tests/test-runner-security-evidence.test.mjs');
  const committed = workflow.jobs.smoke.steps.filter(step => step.name === 'Verify committed publication artifacts');
  assert.equal(committed.length, 1); assert.equal(committed[0].run, 'node --test tests/portal-committed-evidence.test.mjs');
  const network = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate isolated network recovery recheck without promoting physical readiness');
  assert.equal(network.length, 1); assert.equal(network[0].run, 'node --test tests/chat-network-recheck-evidence.test.mjs');
  const gateEvidence = workflow.jobs.smoke.steps.filter(step => step.name === 'Validate full native gate and published media evidence boundaries');
  assert.equal(gateEvidence.length, 1);
  assert.equal(gateEvidence[0].run, 'node --test tests/native-gate-recheck-evidence.test.mjs tests/published-media-seek-evidence.test.mjs tests/short-video-loading.test.mjs tests/short-video-lifecycle.test.mjs tests/buffered-media-evidence.test.mjs');
  const reviews = workflow.jobs.smoke.steps.filter(step => step.name === 'Test completed review history beyond the legacy limit');
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].run, 'npm run test:review-history && node --test tests/review-history-evidence.test.mjs tests/review-history-phone-checkpoints.test.mjs tests/review-history-phone-evidence.test.mjs');
  assert.equal(reviews[0].env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/review-history.json');
});

test('service groups use separate runners and build their own unchanged backend before testing', () => {
  assert.equal(workflow.jobs.smoke['timeout-minutes'], 30);
  assert.equal(workflow.jobs['people-safety']['timeout-minutes'], 20);
  assert.equal(workflow.jobs['guardian-safety']['timeout-minutes'], 20);
  for (const key of smokeGroups) {
    const job = workflow.jobs[key];
    assert.equal(job.needs, undefined); assert.equal(job['runs-on'], 'ubuntu-latest');
    assert.deepEqual(job.permissions, { contents: 'read' });
    const install = job.steps.findIndex(step => step.run === 'npm ci');
    const build = job.steps.findIndex(step => step.run === 'npm run build --workspace functions');
    assert(install >= 0 && build > install);
    for (const step of job.steps) {
      assert.notEqual(step['continue-on-error'], true);
      assert.notEqual(step.if, 'false');
    }
  }
});

test('original and added evidence uploads follow their owning tests', () => {
  const names = [];
  for (const key of smokeGroups) {
    const steps = workflow.jobs[key].steps;
    const uploads = steps.filter(step => step.uses?.startsWith('actions/upload-artifact@'));
    assert(steps.indexOf(uploads[0]) > steps.findLastIndex(step => step.run));
    for (const step of uploads) {
      names.push(step.with.name); assert.match(step.if, /^always\(\)/);
      if (step.with.name === 'team-club-identity-results') {
        assert(steps.some(row => row.id === 'team_club_identity'));
        assert.equal(step.with['if-no-files-found'], 'error');
      }
      if (step.with.name === 'ledger-history-services') assert(steps.some(row => row.env?.SGM_LOCAL_FLOW_OUTPUT?.endsWith('/ledger-history-services.json')));
    }
  }
  assert.equal(names.length, 19); assert.equal(new Set(names).size, 19);
  assert(names.includes('notification-inbox-services-results'));
  assert(names.includes('team-alert-services-results'));
  assert(names.includes('child-booking-receipt-results'));
  assert(names.includes('review-recovery-results'));
  assert(names.includes('review-context-results'));
  assert(names.includes('received-rating-summary-results'));
  assert(names.includes('review-history-results'));
  assert(names.includes('child-contact-discovery-results'));
  assert(names.includes('child-invitation-results'));
});

test('the unchanged required check only succeeds after all three complete groups succeed', () => {
  const gate = workflow.jobs['integration-gate'];
  assert.equal(gate.name, 'Functions, admin, and website smoke');
  assert.equal(gate.if, '${{ always() }}'); assert.deepEqual(gate.needs, smokeGroups);
  assert.deepEqual(gate.permissions, { contents: 'read' }); assert.equal(gate.steps.length, 1);
  const step = gate.steps[0];
  assert.equal(step.env.SMOKE_RESULT, '${{ needs.smoke.result }}');
  assert.equal(step.env.PEOPLE_RESULT, '${{ needs.people-safety.result }}');
  assert.equal(step.env.GUARDIAN_RESULT, '${{ needs.guardian-safety.result }}');
  for (const smoke of ['success', 'failure', 'cancelled', 'skipped', ''])
    for (const people of ['success', 'failure', 'cancelled', 'skipped', ''])
      for (const guardian of ['success', 'failure', 'cancelled', 'skipped', '']) {
        const result = spawnSync('/bin/sh', ['-c', step.run], { env: {
          SMOKE_RESULT: smoke, PEOPLE_RESULT: people, GUARDIAN_RESULT: guardian } });
        assert.equal(result.status === 0, smoke === 'success' && people === 'success' && guardian === 'success');
      }
});

test('the timeout correction preserves every current workload and artifact upload byte-for-byte', () => {
  const steps = smokeGroups.flatMap(key => workflow.jobs[key].steps);
  const diagnostic = steps.filter(step => step.name === 'Test approved temporary network startup logging');
  assert.deepEqual(diagnostic, [{name: 'Test approved temporary network startup logging', run: 'node --test tests/network-startup-logging.test.mjs'}]);
  assert.deepEqual(steps.filter(step => step.name === 'Test approved invitation same-origin transport'),
    [{name: 'Test approved invitation same-origin transport', run: 'node --test tests/invitation-same-origin.test.mjs'}]);
  assert.deepEqual(steps.filter(step => step.name === 'Test invitation-bound phone approval observations'),
    [{name: 'Test invitation-bound phone approval observations', run: 'node --test tests/child-account-phone-binding.test.mjs tests/approved-private-trials.test.mjs tests/parent-approval-input-stop.test.mjs'}]);
  assert.deepEqual(steps.filter(step => step.name === 'Validate bounded public-repository iPhone verification'),
    [{name: 'Validate bounded public-repository iPhone verification', run: 'node --test tests/ios-mvp-workflow.test.mjs tests/ios-search-consent.test.mjs tests/ios-app-data.test.mjs tests/ios-authentication.test.mjs tests/ios-initialized-profile.test.mjs tests/ios-location-stop.test.mjs tests/ios-fixture-launch.test.mjs tests/ios-ride-ownership.test.mjs tests/ios-account-work.test.mjs tests/ios-approved-captures.test.mjs tests/ios-location-shutdown.test.mjs'}]);
  assert.deepEqual(steps.filter(step => step.name === 'Validate bounded node readiness and retained failure scope'),
    [{name: 'Validate bounded node readiness and retained failure scope', run: 'node --test tests/compose-node-readiness.test.mjs tests/guardian-window-observation.test.mjs'}]);
  assert.deepEqual(steps.filter(step => step.name === 'Validate iPhone emergency contact ownership and evidence scope'),
    [{name: 'Validate iPhone emergency contact ownership and evidence scope', run: 'node --test tests/ios-emergency-contact.test.mjs tests/ios-parent-contact.test.mjs tests/ios-message-ownership.test.mjs tests/ios-contact-request.test.mjs'}]);
  for (const [rows, count, expected] of [
    [steps.filter(step => step.run && !setup.has(step.name) && !['Test approved temporary network startup logging', 'Test approved invitation same-origin transport', 'Test invitation-bound phone approval observations', 'Test readable status feedback and error colours', 'Test complete booking dates in enlarged native layouts', 'Validate bounded public-repository iPhone verification', 'Validate bounded node readiness and retained failure scope', 'Validate iPhone emergency contact ownership and evidence scope'].includes(step.name)), 153, '1c44659a0d8be19018d3e1957b84516c546cb55b3e8e797acd165626184d73a5'],
    [steps.filter(step => step.uses?.startsWith('actions/upload-artifact@')), 19, 'ac04ddc85195eb2f779e94230aca82bb8d5f1c78587bfb2cbfa7ae6b5d8c9824'],
  ]) {
    assert.equal(rows.length, count);
    const normalized = rows.map(step => JSON.stringify(step)).sort();
    assert.equal(createHash('sha256').update(JSON.stringify(normalized)).digest('hex'), expected);
  }
});

test('every CI caller of the structured PR check installs the locked YAML dependency first', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
  assert.equal(pkg.devDependencies.yaml, lock.packages['node_modules/yaml'].version);
  assert.equal(lock.packages[''].devDependencies.yaml, pkg.devDependencies.yaml);
  const readiness = parseDocument(readFileSync(new URL('../.github/workflows/release-readiness.yml', import.meta.url), 'utf8')).toJSON();
  for (const source of [workflow, readiness]) {
    for (const job of Object.values(source.jobs)) {
      const checker = job.steps?.findIndex(step => step.run?.includes('npm run test:pr-user-flow-checks')) ?? -1;
      if (checker < 0) continue;
      const install = job.steps.findIndex(step => step.run === 'npm ci');
      assert(install >= 0 && install < checker);
    }
  }
});
