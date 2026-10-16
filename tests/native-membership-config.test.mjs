import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
test('native membership refresh reads current server data under one unchanged identity', () => {
  const gateway = read('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidGroupsGateway.kt');
  assert.equal((gateway.match(/get\(Source.SERVER\)/g) || []).length, 2);
  assert.match(gateway, /loadMembershipByClub\(uid\)/);
  assert.match(gateway, /if \(auth.currentUser\?\.uid != uid\) throw CancellationException/);
  const route = read('android/app/src/main/java/be/sportgreenmoove/app/ui/GroupsRoute.kt');
  assert.match(route, /remember\(sessionUid, providers\)/);
  assert.match(route, /onDispose \{ state.close\(\) \}/);
  assert.match(route, /repeatOnLifecycle\(Lifecycle.State.STARTED\)/);
  assert(!existsSync(new URL('android/app/src/main/java/be/sportgreenmoove/app/ui/ClubMembershipActions.kt', root)));
});
test('membership evidence requires app requests, manager authorization and independent state checks', () => {
  const runner = read('scripts/qa/local-android-session.mjs');
  assert.match(runner, /instrument\(\['LocalMembershipFlowTest'\], 1\)/);
  assert.match(runner, /membershipRefresh = await verifyNativeMembershipUi\(\)/);
  const peer = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalMembershipPeer.kt');
  assert.match(peer, /check\(BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR\)/);
  assert.match(peer, /options.projectId == "demo-sgm-local-qa"/);
  assert.match(peer, /getHttpsCallable\("reviewClubMembership"\)/);
  assert.match(peer, /"expectedVersion" to membership\["requestVersion"\]/);
  assert.match(peer, /app.delete\(\)/);
  const verifier = read('scripts/qa/local-native-membership.mjs');
  assert.match(verifier, /assert.equal\(reviews.size, 3/);
  assert.match(verifier, /assert.equal\(memberCount, 2/);
  assert.match(verifier, /assert.deepEqual\(user.customClaims.roleKeys, \['parent'\]\)/);
  assert.match(verifier, /livePush: false/);
});
test('retained state tests cover the new controller and whole-app snapshot boundary', () => {
  const base = 'docs/release/evidence/local-membership-refresh-2026-10-16/';
  assert.match(read(base + 'groups-state.xml'), /tests="9" skipped="0" failures="0" errors="0"/);
  assert.match(read(base + 'app-data-state.xml'), /tests="6" skipped="0" failures="0" errors="0"/);
  assert.match(read(base + 'app-data-state.xml'), /aSlowAppSnapshotCannotUndoANewerGroupsRefresh/);
});
