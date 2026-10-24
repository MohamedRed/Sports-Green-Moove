import assert from 'node:assert/strict';
import { observeNetworkBootstrap } from './network-bootstrap-observation.mjs';

assert.equal(process.argv.length, 3);
observeNetworkBootstrap(process.argv[2]);
console.log('Read-only pre-installation network observations saved; no flow success or provisioning repair implied.');
