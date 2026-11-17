import assert from 'node:assert/strict';
import test from 'node:test';
import {summarizeResolverConfiguration as summarize} from '../scripts/qa/host-dns-configuration.mjs';

test('resolver summaries keep family/order/categories but no addresses, search domains, comments or options', () => {
  const result = summarize('# PRIVATE_TOKEN\nsearch private.customer.test\ndomain private.test\noptions timeout:5 private-option\n' +
    'nameserver 127.0.0.53 # SECRET\nnameserver 192.0.2.44\nnameserver ::1\nnameserver 2001:db8::42\nnameserver 198.51.100.9\n');
  assert.equal(result.serverCount, 5); assert.equal(result.loopbackServerCount, 2);
  assert.equal(result.ipv4ServerCount, 3); assert.equal(result.ipv6ServerCount, 2);
  assert.deepEqual(result.firstFourServerCategories, [{family: 4, category: 'loopback'}, {family: 4, category: 'non-loopback'},
    {family: 6, category: 'loopback'}, {family: 6, category: 'non-loopback'}]);
  for (const key of ['searchDirectivePresent', 'domainDirectivePresent', 'optionsDirectivePresent']) assert.equal(result[key], true);
  for (const key of ['serverAddressesRetained', 'searchDomainsRetained', 'rawContentsRetained', 'actualEmulatorBindingVerified', 'resolutionVerified'])
    assert.equal(result[key], false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|SECRET|private|customer|127\.|192\.|198\.|2001:|timeout/);
});
test('mapped IPv6, scoped IPv6 and unspecified addresses remain distinct without a resolver substitution', () => {
  assert.deepEqual(summarize('nameserver ::ffff:127.0.0.53\nnameserver fe80::1%eth0\nnameserver 0.0.0.0\nnameserver ::\n')
    .firstFourServerCategories, [{family: 6, category: 'loopback'}, {family: 6, category: 'non-loopback'},
      {family: 4, category: 'unspecified'}, {family: 6, category: 'unspecified'}]);
  const empty = summarize('# private comment\noptions rotate\n');
  assert.equal(empty.serverCount, 0); assert.deepEqual(empty.firstFourServerCategories, []);
  assert.equal(empty.resolutionVerified, false);
});
test('normal whitespace, comments and repeated servers are counted without fabricating exact identity', () => {
  const result = summarize('  nameserver\t127.0.0.53 ; comment\r\nnameserver 127.0.0.53\r\nsortlist PRIVATE\n');
  assert.equal(result.serverCount, 2); assert.equal(result.loopbackServerCount, 2); assert.equal(result.otherDirectiveCount, 1);
  assert.equal(result.actualEmulatorBindingVerified, false); assert(!('serverIdentity' in result));
});
for (const input of ['nameserver PRIVATE_SECRET', 'nameserver 999.1.2.3', 'nameserver', 'nameserver 127.0.0.1 extra',
  'nameserver 127.0.0.1%PRIVATE_SECRET', 'nameserver ::1%zone%PRIVATE_SECRET', 'nameserver ::1%bad/PRIVATE_SECRET',
  'x'.repeat(65537), 'nameserver ::1\n'.repeat(65)]) test('malformed or oversized resolver directives are rejected without raw input', () => {
  assert.throws(() => summarize(input), error => !error.message.includes('PRIVATE_SECRET') && error.message.length < 200);
});
