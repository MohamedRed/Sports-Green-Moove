import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chatAccountSwitchPhases,verifyChatAccountSwitchCheckpoint} from '../scripts/qa/chat-account-switch-checkpoints.mjs';

const root = new URL('../docs/release/evidence/chat-pending-restart-phone-2026-10-31/records/', import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(file+'.json', root)));
const baseline = read('baseline'), fixture = read('fixture').fixture, sent = read('parent-sent').state;

test('historical records exercise the checker only, never a fresh phone run', () => {
  assert.equal(chatAccountSwitchPhases.length, 11);
  for (const [index,phase] of chatAccountSwitchPhases.entries()) {
    const result = verifyChatAccountSwitchCheckpoint(phase,baseline,index < 9 ? baseline : sent,fixture);
    assert.equal(result.messageCount,index < 9 ? 0 : 1);
    assert.equal(result.accountUiIsolationProvenByObserver,false);
    assert.equal(result.originalPendingIdentityProvenByObserver,false);
  }
});

test('a message before the parent explicitly retries is rejected at every pre-send phase', () => {
  for (const phase of chatAccountSwitchPhases.slice(0,9)) {
    assert.throws(()=>verifyChatAccountSwitchCheckpoint(phase,baseline,sent,fixture));
  }
  assert.throws(()=>verifyChatAccountSwitchCheckpoint('parent-sent',baseline,baseline,fixture));
  assert.throws(()=>verifyChatAccountSwitchCheckpoint('unknown',baseline,baseline,fixture));
});

test('only driver initialization timestamp is excluded; other profile fields and claims stay protected', () => {
  const state=structuredClone(baseline),driver=state.documents.users.find(row=>row.id===fixture.driverUid);
  driver.data.updatedAt={_seconds:1,_nanoseconds:0};
  verifyChatAccountSwitchCheckpoint('driver-home',baseline,state,fixture);
  driver.data.displayName='Changed foreign profile';
  assert.throws(()=>verifyChatAccountSwitchCheckpoint('driver-home',baseline,state,fixture));
  const claimState=structuredClone(baseline);claimState.claims[0].claims={admin:true};
  assert.throws(()=>verifyChatAccountSwitchCheckpoint('ready',baseline,claimState,fixture));
});

test('the interactive controller cannot send chat or accept out-of-order checkpoints', () => {
  const source=readFileSync(new URL('../scripts/qa/manual-chat-account-switch-phone.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/call\('sendChatMessage'/);
  assert.match(source,/assert\.equal\(phase,chatAccountSwitchPhases\[checkpoints\.length\]\)/);
  assert.match(source,/await db\.terminate\(\)/);assert.match(source,/await deleteApp\(app\)/);
});
