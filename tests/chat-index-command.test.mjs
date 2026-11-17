import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChatIndexCommand } from '../scripts/lib/chat-index-command.mjs';

const base = ['--project', 'demo-sgm-local-qa', '--user', 'parent-1', '--booking', 'booking-1'];
test('conversation indexing is explicit, scoped to one user/source and dry-run by default', () => {
  const command = parseChatIndexCommand(base);
  assert.equal(command.apply, false);
  assert.deepEqual(command.source, { sourceType: 'booking', sourceId: 'booking-1' });
  assert.equal(parseChatIndexCommand(['--project', 'sports-green-moove-prod', '--user', 'u', '--ride', 'r']).apply, false);
});
test('apply requires both exact project confirmation and explicit quiescence', () => {
  assert.throws(() => parseChatIndexCommand([...base, '--apply']), /project confirmation/);
  assert.throws(() => parseChatIndexCommand([...base, '--apply', '--confirm-project', 'demo-sgm-local-qa']), /quiescent/);
  assert.throws(() => parseChatIndexCommand([...base, '--apply', '--confirm-project', 'sports-green-moove-prod', '--confirm-quiescent']), /project confirmation/);
  assert.equal(parseChatIndexCommand([...base, '--apply', '--confirm-project', 'demo-sgm-local-qa', '--confirm-quiescent']).apply, true);
});
test('malformed, ambiguous, implicit or broad project/source selections fail closed', () => {
  for (const args of [[], [...base, '--ride', 'r'], [...base, '--all'],
    ['--project', 'other-project', '--user', 'u', '--booking', 'b'],
    ['--project', 'demo-sgm-local-qa', '--user', 'a/b', '--booking', 'b'],
    ['--project', 'demo-sgm-local-qa', '--user', 'u', '--booking', '../b'],
    [...base, '--confirm-project', 'demo-sgm-local-qa'], [...base, '--confirm-quiescent']]) {
    assert.throws(() => parseChatIndexCommand(args));
  }
});
