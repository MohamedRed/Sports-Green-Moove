import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';

export function validateNativeSocketProbeScope(report) {
  assert.equal(report.scope, 'independent-physical-phone-loopback-transport-probe-not-app-flow-proof');
  assert.equal(report.httpResult, 'VERIFIED_204'); assert.equal(report.nativeSocketResult, 'ECONNREFUSED');
  assert.equal(report.isolatedTransportMismatchObserved, true);
  assert.equal(report.configuredHost, '127.0.0.1'); assert.equal(report.configuredPort, 9000);
  assert.equal(report.ownedServerRequestCount, 1); assert.deepEqual(report.publicMedia, []);
  for (const key of ['productionBugProven', 'providerWideLimitationProven', 'mainAppCodeChanged', 'workaroundInstalled',
    'trackingFlowAccepted', 'productionWrites', 'releaseScenariosAccepted']) assert.equal(report[key], false, key);
  for (const key of ['accountsUsed', 'paymentRequests', 'routeProviderRequests']) assert.equal(report[key], 0);
  assert.equal(report.cleanup.packageAbsenceProven, false);
  for (const key of ['uninstallAcknowledged', 'phoneSessionStopped', 'helperGroupStopped', 'helperHandoffRemoved',
    'ownedServerStopped', 'loopbackPortsClosed']) assert.equal(report.cleanup[key], true);
}

export function validateNativeSocketProbe(root, record) {
  const base = resolve(root, dirname(record.source)); assertEvidenceBundleChecksums(base);
  assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
  const read = file => readFileSync(resolve(base, file), 'utf8');
  const report = JSON.parse(read('summary.json')); validateNativeSocketProbeScope(report);
  assert.equal(report.testedAt.slice(0, 10), record.checkedAt);
  assert.match(report.uploadedApkSha256, /^[a-f0-9]{64}$/); assert.equal(report.device.physical, true);
  assert.equal(report.observedVia, 'reviewed-unscaled-streamed-phone-viewport');
  for (const [file, expected] of Object.entries(report.sourceFiles)) {
    assert(!file.split('/').includes('..'));
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, 'source', file))).digest('hex'), expected);
  }
  const manifest = new XMLParser({ignoreAttributes: false}).parse(read('source/app/src/main/AndroidManifest.xml')).manifest;
  assert.deepEqual(manifest['uses-permission'], {'@_android:name': 'android.permission.INTERNET'});
  assert.equal(manifest.application['@_android:allowBackup'], 'false');
  const activity = read('source/app/src/main/java/be/sportgreenmoove/qa/connectivity/ProbeActivity.java');
  assert(activity.includes('String HOST = "127.0.0.1"')); assert(activity.includes('int PORT = 9000'));
  assert(activity.includes('OsConstants.ECONNREFUSED')); assert(activity.includes('"CONNECTED_ORIGIN_UNVERIFIED"'));
  assert(activity.includes('connection.setInstanceFollowRedirects(false)'));
  assert.doesNotMatch(activity, /getIntent|getExtras|FirebaseAuth|password|Bearer|ACCESS_KEY|Log\./);
  assert(read('build.log.txt').includes('BUILD SUCCESSFUL'));
  assert(read('apk-badging.txt').includes("package: name='be.sportgreenmoove.qa.connectivity'"));
  const requests = read('server.log.txt').split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(requests.length, report.ownedServerRequestCount);
  assert.equal(requests[0].servedAt, report.testedAt);
  assert.equal(requests[0].scope, 'isolated-http-probe-no-accounts-or-payloads');
  assert.equal(report.sdk.artifact, 'com.google.firebase:firebase-database:22.0.1');
  assert.match(report.sdk.aarSha256, /^[a-f0-9]{64}$/);
  assert.equal(report.sdk.plainWebSocketUsesDirectSocketConstructor, true);
  assert(read('firebase-websocket-bytecode.txt').includes('java/net/Socket."<init>":(Ljava/lang/String;I)V'));
  const viewport = imageSize(readFileSync(resolve(base, 'internal/phone-viewport.jpg')));
  assert.equal(viewport.width, 253); assert.equal(viewport.height, 564);
  assert(imageSize(readFileSync(resolve(base, 'internal/phone-result.png'))).width > viewport.width);
  assert.match(read('local-connection.txt'), /checkbox Description: Local testing, Value: 1/);
  assert.match(read('local-connection.txt'), /Resolve all URLs through my network, Value: 0/);
  assert.match(read('uninstall.txt'), /Succesfully uninstalled your app/);
  assert.match(read('session-stopped.txt'), /App Live Dashboard/);
  return report;
}
