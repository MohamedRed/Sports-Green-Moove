import './local-egress-guard.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync, execFileSync} from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const app = resolve(root, 'ios/Sources/SportsGreenMooveApp');
const build = mkdtempSync(resolve(tmpdir(), 'sgm-search-contract-'));
const baseline = process.argv.includes('--observe-baseline');
assert(['darwin', 'linux'].includes(process.platform), 'Search contract runner requires macOS or Linux');
const suffix = process.platform === 'darwin' ? 'dylib' : 'so';
const libraryPath = process.platform === 'darwin' ? 'DYLD_LIBRARY_PATH' : 'LD_LIBRARY_PATH';
const source = name => {
  if (!baseline || !['FirebaseSearchGateway.swift', 'FirebaseMapMappers.swift'].includes(name)) return resolve(app, name);
  const path = resolve(build, name);
  writeFileSync(path, execFileSync('git', ['show', 'cd76635276252e9feabf25e0cf8b90750728f6b8:ios/Sources/SportsGreenMooveApp/' + name], {cwd: root}));
  return path;
};
const run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, {cwd: root, env, stdio: 'inherit', timeout: 120_000});
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed (${result.status})`);
};
try {
  run('npm', ['run', 'build', '--workspace', 'functions']);
  const {toClientTripSummary} = await import('../../functions/lib/lib/clientTrips.js');
  const {tripInput} = await import('./local-trip-input.mjs');
  const matches = [0, 250, 99999].map((priceCents, i) => {
    const encoded = i === 2 ? '_p~iF~ps|U_ulLnnqC_mqNvxq`@' : undefined;
    const trip = {...tripInput(), id: `isolated-contract-${i}`, driverUserId: 'isolated-driver',
      priceCents, departureAt: '2026-11-30T14:45:00.000Z', arrivalBy: '2026-11-30T16:45:00.000Z',
      appliedChangeId: 'a'.repeat(64), passengerInitials: ['QA'], status: 'published', routeEncodedPolyline: encoded};
    return {tripId: trip.id, score: 88.5, reasons: ['Deux places disponibles'],
      route: {detourDurationSeconds: 390, pickupDistanceMeters: 250, finalEncodedPolyline: encoded}, summary: toClientTripSummary(trip)};
  });
  const fixture = resolve(build, 'matches.json');
  writeFileSync(fixture, JSON.stringify({matches}));
  const flags = ['-swift-version', '6', '-strict-concurrency=complete', '-warnings-as-errors'];
  for (const [name, source] of [['FirebaseAuth', 'ios-ride-chat-runtime/FirebaseAuth.swift'],
    ['FirebaseFunctions', 'ios-search-callable/FirebaseFunctions.swift']]) {
    run('swiftc', [...flags, '-emit-module', '-emit-library', '-module-name', name,
      resolve(root, 'tests/fixtures', source), '-emit-module-path', resolve(build, name + '.swiftmodule'),
      '-o', resolve(build, 'lib' + name + '.' + suffix)]);
  }
  const sources = ['Models.swift', 'ClubSummary.swift', 'BookingIntentSnapshot.swift', 'PendingReviews.swift',
    'ReviewTripContext.swift', 'ProviderConfigurationError.swift', 'FirebaseMapMappers.swift', 'FirebaseSearchGateway.swift',
    'TripSearchWire.swift', 'EncodedRouteValidation.swift', 'TeamChatText.swift'];
  const binary = resolve(build, 'check');
  run('swiftc', [...flags, '-I', build, '-L', build, '-lFirebaseAuth', '-lFirebaseFunctions',
    resolve(root, 'tests/fixtures/ios-search-contract/main.swift'),
    resolve(root, 'tests/fixtures/ios-search-contract/Mutations.swift'), ...sources.map(source), '-o', binary]);
  run(binary, [fixture, baseline ? 'baseline' : 'verify'], {...process.env, [libraryPath]: build});
} finally { rmSync(build, {recursive: true, force: true}); }
