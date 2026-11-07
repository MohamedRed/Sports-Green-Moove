import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';

const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256 &&
  !value.includes('/') && !['.', '..'].includes(value) && !/^__.*__$/.test(value);

export function parseChatIndexCommand(args) {
  const { values } = parseArgs({ args, strict: true, allowPositionals: false, options: {
    project: { type: 'string' }, user: { type: 'string' }, booking: { type: 'string' }, ride: { type: 'string' },
    apply: { type: 'boolean', default: false }, 'confirm-project': { type: 'string' },
    'confirm-quiescent': { type: 'boolean', default: false },
  } });
  assert(['demo-sgm-local-qa', 'sports-green-moove-dev', 'sports-green-moove-staging', 'sports-green-moove-prod']
    .includes(values.project), 'Select an explicit Sports Green-Moove project');
  assert(validId(values.user) && values.user.length <= 128, 'Select one explicit valid user ID');
  assert(Boolean(values.booking) !== Boolean(values.ride), 'Select exactly one booking or ride');
  const sourceId = values.booking ?? values.ride;
  assert(validId(sourceId), 'Invalid conversation source ID');
  if (values.apply) {
    assert.equal(values['confirm-project'], values.project, 'Apply requires the exact project confirmation');
    assert.equal(values['confirm-quiescent'], true, 'Apply requires quiescent message writes and reads');
  } else {
    assert(!values['confirm-project'] && !values['confirm-quiescent'], 'Confirmation flags do not enable apply');
  }
  return { projectId: values.project, userId: values.user, apply: values.apply,
    source: { sourceType: values.booking ? 'booking' : 'rideSession', sourceId } };
}
