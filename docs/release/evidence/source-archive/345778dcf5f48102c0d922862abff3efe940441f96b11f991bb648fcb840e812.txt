import assert from 'node:assert/strict';
import { supportRecoveryPhases, verifySupportRecoveryCheckpoint } from './manual-support-recovery-checkpoints.mjs';

const connected = Object.freeze({ prepared: 'prepared', committed: 'committed', unconfirmed: 'committed',
  stopped: 'uncertain', reopened: 'reopened', confirmed: 'confirmed',
  'confirmed-stopped': 'confirmed', 'confirmed-reopened': 'restored', foreign: 'foreign', restored: 'restored' });

export function supportRecoveryProtocol(scenario = 'network-response-loss') {
  assert(['network-response-loss', 'connected-process-restart'].includes(scenario), 'Select an explicit known support trial');
  const checkpoints = scenario === 'connected-process-restart' ? connected :
    Object.fromEntries(supportRecoveryPhases.map(phase => [phase, phase]));
  return { scenario, phases: Object.keys(checkpoints), checkpoints,
    releaseAfter: scenario === 'connected-process-restart' ? 'unconfirmed' : 'offline' };
}

export function verifySupportProtocolCheckpoint(protocol, phase, state, fixture) {
  const expected = supportRecoveryProtocol(protocol.scenario); assert.deepEqual(protocol, expected);
  assert(Object.hasOwn(protocol.checkpoints, phase), 'Unknown trial checkpoint');
  const result = verifySupportRecoveryCheckpoint(protocol.checkpoints[phase], state, fixture);
  // Labels describe operator checkpoints; saved records do not prove phone/process/network state.
  return { ...result, phase };
}

export function assertSupportResponseRelease(protocol, checkpoints) {
  assert.deepEqual(protocol, supportRecoveryProtocol(protocol.scenario));
  const expected = protocol.phases.slice(0, protocol.phases.indexOf(protocol.releaseAfter) + 1);
  assert.deepEqual(checkpoints.map(row => row.phase), expected, 'Release only after the exact observed pre-release sequence');
}
