import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';

const {mode, variant, directory} = JSON.parse(readFileSync(0, 'utf8'));
let networkAttempts = 0;
const deny = () => {networkAttempts++; throw new Error('Parser probe network access denied');};
net.Socket.prototype.connect = deny; tls.connect = deny; dns.lookup = deny;
const require = createRequire(import.meta.url), stripe = createRequire(require.resolve('stripe'));
const admin = createRequire(require.resolve('firebase-admin'));
const firestore = createRequire(admin.resolve('@google-cloud/firestore'));
const gax = createRequire(firestore.resolve('google-gax'));
const loader = createRequire(gax.resolve('@grpc/proto-loader'));
const consumer = mode.startsWith('proto') ? loader : stripe;
const name = mode.startsWith('proto') ? 'protobufjs' : 'qs';
const version = consumer(name + '/package.json').version;
console.log(JSON.stringify({ready: true, mode, variant, version, networkGuardActive: true}));
let result;
if (mode === 'proto-malformed' || mode === 'proto-normal') {
  assert(['parse', 'load', 'loadSync', 'wire'].includes(variant)); assert(isAbsolute(directory));
  const protobuf = loader('protobufjs');
  const normal = 'syntax = "proto3"; package qa; message Ride { string bookingId = 1; int32 seats = 2; } service RideService { rpc Book(Ride) returns (Ride); }';
  const source = mode === 'proto-malformed' ? 'syntax = "proto3"; option unfinished' : normal;
  const path = resolve(directory, 'isolated.proto'); writeFileSync(path, source, {flag: 'wx'});
  try {
    if (variant === 'wire') {
      assert.equal(mode, 'proto-normal');
      const definitions = gax('@grpc/proto-loader').loadSync(path), body = {bookingId: 'synthetic-booking', seats: 2};
      const method = definitions['qa.RideService'].Book;
      assert.deepEqual(method.requestDeserialize(method.requestSerialize(body)), body);
      assert.deepEqual(method.responseDeserialize(method.responseSerialize(body)), body);
      result = {normalWireRoundTrip: true};
    } else {
      const parsed = variant === 'parse' ? protobuf.parse(source).root : variant === 'loadSync' ?
        new protobuf.Root().loadSync(path) : await new protobuf.Root().load(path);
      if (mode === 'proto-malformed') result = {rejected: false};
      else {
        const type = parsed.lookupType('qa.Ride'), body = {bookingId: 'synthetic-booking', seats: 2};
        assert.deepEqual(type.toObject(type.decode(type.encode(type.create(body)).finish())), body);
        result = {normalWireRoundTrip: true};
      }
    }
  } catch (error) {
    if (mode !== 'proto-malformed') throw error;
    result = {rejected: true, expectedSyntaxError: /illegal|unexpected|end of|EOF/i.test(error.message), errorName: error.name};
  }
} else if (mode === 'query-malformed') {
  const qs = stripe('qs');
  if (variant === 'stripe-buffer') {
    const input = qs.parse('ride[constructor][isBuffer]=synthetic', {plainObjects: true});
    const encoded = stripe('./utils.js').queryStringifyRequestData(input);
    result = {encoded, hostileValuePreservedAsData: encoded.includes('ride[constructor][isBuffer]=synthetic')};
  } else {
    assert(['comma', 'comma-encoded'].includes(variant));
    const encoded = qs.stringify({ride: [{toString: 'synthetic'}]}, {arrayFormat: 'comma', encodeValuesOnly: variant === 'comma-encoded'});
    result = {encoded, safelyCoerced: encoded === 'ride=%5Bobject%20Object%5D'};
  }
} else if (mode === 'query-normal') {
  assert(['v1', 'v2'].includes(variant));
  const encoded = stripe('./utils.js').queryStringifyRequestData({ride: {bookingId: 'synthetic-booking'}, seats: [1, 2]}, variant);
  result = {encoded, expectedShape: variant === 'v1' ? encoded === 'ride[bookingId]=synthetic-booking&seats[0]=1&seats[1]=2' :
    encoded === 'ride[bookingId]=synthetic-booking&seats=1&seats=2'};
} else throw new Error('Unknown isolated parser probe');
assert.equal(networkAttempts, 0);
console.log(JSON.stringify({finished: true, mode, variant, version, networkAttempts, result,
  actualConsumer: mode.startsWith('proto') ? 'firebase-admin/firestore/google-gax/proto-loader/protobufjs' : 'stripe/qs'}));
