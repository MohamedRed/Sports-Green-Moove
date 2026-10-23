import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateBookingRequestNoticeEvidence } from '../scripts/qa/booking-request-notice-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const flow=content.flows.find(row=>row.id==='booking'),record=flow.requestNoticeChecks;
test('request notices retain actual local records, concurrency, privacy and separate dated phone evidence',()=>{
  const run=validateBookingRequestNoticeEvidence(process.cwd(),record);
  assert.equal(run.steps.length,20); assert.equal(run.protectedRecordCount,158);
  assert.equal(flow.status,'partial'); assert.equal(flow.checkedAt,'2026-10-23');
  assert.equal(flow.decisionPhone.checkedAt,'2026-10-22');
  assert(flow.images.filter(row=>row.file.startsWith('booking-decision-phone-')).every(row=>row.alt.includes('22 octobre')));
});
for(const [name,mutate] of [
  ['missing-case',run=>run.steps.pop()],['duplicate-case',run=>run.steps[1]=run.steps[0]],
  ['wrong-recipient',run=>run.requestNoticeRecords[0].notice.userId='sgm-qa-parent'],
  ['private-note-leak',run=>run.requestNoticeRecords[0].notice.note='QA note'],
  ['read-reset',run=>run.requestNoticeRecords.find(row=>row.kind==='request-read-replay').afterNotice.read=false],
  ['read-time-changed',run=>run.requestNoticeRecords.find(row=>row.kind==='request-read-replay').afterNotice.readAt._seconds++],
  ['approval-on-read',run=>run.requestNoticeRecords[0].booking.status='approved'],
  ['capacity-on-request',run=>run.requestNoticeRecords[0].seatsAvailable=2],
  ['open-runtime',run=>run.isolatedEnvironmentDestroyed=false],['push-promotion',run=>run.pushDeliveryVerified=true],
]) test('isolated request evidence rejects '+name,t=>{
  const root=mkdtempSync(resolve(tmpdir(),'sgm-request-notice-proof-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const base=dirname(record.source);cpSync(base,resolve(root,base),{recursive:true});
  const path=resolve(root,record.source),run=JSON.parse(readFileSync(path));mutate(run);writeFileSync(path,JSON.stringify(run));
  assert.throws(()=>validateBookingRequestNoticeEvidence(root,record));
});
test('request notice and coexistence checks stay wired to both service CI paths',()=>{
  for(const file of ['backend-ci.yml','web-integration-smoke.yml']) {
    const source=readFileSync('.github/workflows/'+file,'utf8');
    assert(source.includes('npm run test:booking-notices'));assert(source.includes('tests/booking-request-notice-evidence.test.mjs'));
  }
});
