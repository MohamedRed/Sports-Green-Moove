import assert from 'node:assert/strict';
import {lookup} from 'node:dns/promises';

export const privateInvitationAlias = 'bs-local.com';
export async function assertInvitationAliasTarget(lookupHost = lookup) {
  const addresses = await lookupHost(privateInvitationAlias, {all: true});
  assert(addresses.length > 0 && addresses.every(row => ['127.0.0.1', '::1'].includes(row.address)),
    'The approved invitation alias must resolve only to loopback');
  return {host: privateInvitationAlias, port: 4185, loopbackOnly: true};
}
