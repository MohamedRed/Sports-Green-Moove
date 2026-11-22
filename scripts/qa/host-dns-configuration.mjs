import assert from 'node:assert/strict';
import {BlockList, isIP} from 'node:net';

const loopbacks = new BlockList(), unspecified = new BlockList();
loopbacks.addSubnet('127.0.0.0', 8, 'ipv4'); loopbacks.addAddress('::1', 'ipv6');
unspecified.addAddress('0.0.0.0', 'ipv4'); unspecified.addAddress('::', 'ipv6');

export function summarizeResolverConfiguration(raw) {
  assert(typeof raw === 'string' && Buffer.byteLength(raw) <= 65536, 'Resolver input exceeds its fixed text budget');
  const servers = [];
  let searchDirectivePresent = false, domainDirectivePresent = false, optionsDirectivePresent = false, otherDirectiveCount = 0;
  for (const line of raw.split(/\r?\n/)) {
    const fields = line.split(/[;#]/, 1)[0].trim().split(/\s+/);
    if (!fields[0]) continue;
    if (fields[0] === 'nameserver') {
      assert(fields.length === 2 && fields[1].length <= 128, 'Invalid resolver address directive');
      const [address, zone, extra] = fields[1].split('%');
      assert(extra === undefined && (zone === undefined || /^[A-Za-z0-9_.:-]{1,64}$/.test(zone)), 'Invalid resolver address scope');
      const family = isIP(address); assert(family !== 0, 'Resolver address is not an IP literal');
      assert(zone === undefined || family === 6, 'Address scope requires IPv6');
      const type = family === 4 ? 'ipv4' : 'ipv6';
      servers.push({family, category: loopbacks.check(address, type) ? 'loopback' :
        unspecified.check(address, type) ? 'unspecified' : 'non-loopback'});
      assert(servers.length <= 64, 'Too many resolver address directives');
    } else if (fields[0] === 'search') searchDirectivePresent = true;
    else if (fields[0] === 'domain') domainDirectivePresent = true;
    else if (fields[0] === 'options') optionsDirectivePresent = true;
    else otherDirectiveCount++;
  }
  return {serverCount: servers.length, firstFourServerCategories: servers.slice(0, 4),
    loopbackServerCount: servers.filter(row => row.category === 'loopback').length,
    unspecifiedServerCount: servers.filter(row => row.category === 'unspecified').length,
    ipv4ServerCount: servers.filter(row => row.family === 4).length,
    ipv6ServerCount: servers.filter(row => row.family === 6).length,
    searchDirectivePresent, domainDirectivePresent, optionsDirectivePresent, otherDirectiveCount,
    serverAddressesRetained: false, searchDomainsRetained: false, rawContentsRetained: false,
    actualEmulatorBindingVerified: false, resolutionVerified: false};
}
