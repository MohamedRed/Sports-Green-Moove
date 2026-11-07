import assert from 'node:assert/strict';

export const hostDnsTestStep = {name: 'Validate passive host DNS observations',
  run: 'node --test tests/host-dns-configuration.test.mjs tests/host-dns-system-inputs.test.mjs tests/host-dns-filesystem.test.mjs tests/host-dns-observation.test.mjs tests/host-dns-workflow.test.mjs'};
export const hostDnsStep = focused => ({name: 'Observe host DNS before disposable launch',
  ...(focused ? {if: "${{ matrix.case == 'chat-network-recovery' }}"} : {}),
  env: {SGM_LOCAL_DISPOSABLE_EMULATOR: 'true'},
  run: 'node scripts/qa/observe-host-dns.mjs ' + (focused ? 'chat-network-recovery' : 'full-matrix')});

export function withoutHostDnsSteps(jobs, focused = false) {
  const copy = structuredClone(jobs);
  const remove = (jobId, expected, neighbor, before) => {
    const steps = copy[jobId].steps, matches = steps.map((row, index) => row.name === expected.name ? index : -1).filter(index => index >= 0);
    assert.equal(matches.length, 1, 'One exact passive observation step is required');
    const index = matches[0]; assert.deepEqual(steps[index], expected);
    assert.equal(steps[index + (before ? 1 : -1)]?.name, neighbor); steps.splice(index, 1);
  };
  if (focused) remove('focused-case', hostDnsStep(true), 'Run one isolated safety flow on its own phone', true);
  else {
    remove('native-ui-coverage', hostDnsTestStep, 'Validate sanitized host transport observations', false);
    remove('android-native-ui', hostDnsStep(false), 'Run Android Compose UI tests', true);
  }
  return copy;
}
