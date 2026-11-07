import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUiScope } from '../partner-portal/validate.mjs';

const component = { scope: 'local-native-component-ui-not-physical-device', projectId: null,
  applicationBackendConnected: false, gateway: 'in-memory-fixture', fullAppReplay: false,
  physicalDevice: false, realProviderOutcomesVerified: false, componentSuiteCompleted: true,
  failures: 0, errors: 0, skipped: 0, testCount: 1,
  steps: [{ id: 'component-case', status: 'passed' }], sourceCommit: 'a'.repeat(40),
  sourceRun: 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/123' };

test('explicit component scope does not impersonate a connected application or phone replay', () => {
  validateUiScope(component);
  validateUiScope({ scope: 'local-ui-not-physical-device', projectId: 'demo-sgm-local-qa' });
  for (const change of [{ projectId: 'demo-sgm-local-qa' }, { applicationBackendConnected: true },
    { gateway: 'real' }, { fullAppReplay: true }, { physicalDevice: true }, { realProviderOutcomesVerified: true },
    { componentSuiteCompleted: false }, { scope: 'unrecognized' }, { sourceCommit: 'stale' }, { sourceRun: 'https://example.test/123' }])
    assert.throws(() => validateUiScope({ ...component, ...change }));
});

test('incomplete, failed or skipped component cases cannot be accepted', () => {
  for (const change of [{ failures: 1 }, { errors: 1 }, { skipped: 1 }, { testCount: 0 }, { testCount: 1.5 },
    { testCount: 2 }, { steps: [] }, { steps: [{ id: 'component-case', status: 'failed' }] },
    { testCount: 2, steps: [component.steps[0], component.steps[0]] }])
    assert.throws(() => validateUiScope({ ...component, ...change }));
});
