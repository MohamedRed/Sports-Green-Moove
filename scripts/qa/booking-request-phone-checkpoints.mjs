import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const bookingRequestPhonePhases = ['prepared','parent-requested','driver-unread','driver-read','parent-returned','driver-returned'];
const noticeId = (bookingId,driverUid) => 'bookingDecision_' + createHash('sha256')
  .update(JSON.stringify(['bookingRequested',bookingId,driverUid])).digest('hex');
const millis = value => {
  assert(Number.isSafeInteger(value?._seconds) && Number.isInteger(value?._nanoseconds));
  assert(value._nanoseconds>=0 && value._nanoseconds<1e9);
  return value._seconds*1000+Math.floor(value._nanoseconds/1e6);
};

export function verifyBookingRequestPhoneState(phase,state,baseline,fixture) {
  const index=bookingRequestPhonePhases.indexOf(phase);assert(index>=0);
  assert.equal(fixture.parentUid,'sgm-qa-parent');assert.equal(fixture.driverUid,'sgm-qa-driver');
  assert(fixture.tripId && fixture.parentUid!==fixture.driverUid);
  const protectedRecordCount=Object.values(baseline.documents).reduce((n,rows)=>n+rows.length,0);
  if(index===0) {
    assert.deepEqual(state.records,baseline);assert.equal(state.bookings.length,0);assert.equal(state.notices.length,0);
    return {phase,protectedRecordCount,requestExists:false,physicalUiProven:false};
  }
  assert.equal(state.bookings.length,1);assert.equal(state.notices.length,1);assert.equal(state.receipts.length,1);
  const booking=state.bookings[0],notice=state.notices[0],receipt=state.receipts[0];
  assert.equal(booking.data.tripId,fixture.tripId);assert.equal(booking.data.parentUserId,fixture.parentUid);
  assert.equal(booking.data.requesterUserId,fixture.parentUid);assert.equal(booking.data.driverUserId,fixture.driverUid);
  assert.equal(booking.data.status,'requested');assert.equal(booking.data.seats,1);
  assert(!Object.hasOwn(booking.data,'childId'));assert(!Object.hasOwn(booking.data,'paymentIntentId'));
  assert.equal(receipt.data.uid,fixture.parentUid);assert.equal(receipt.data.state,'committed');
  assert.equal(receipt.data.response.bookingId,booking.id);assert.equal(receipt.data.response.trip.id,fixture.tripId);
  assert.equal(receipt.data.response.clientRequestId,receipt.data.clientRequestId);
  assert.equal(receipt.data.response.status,'requested');assert.match(receipt.data.fingerprint,/^[a-f0-9]{64}$/);
  assert.equal(notice.id,noticeId(booking.id,fixture.driverUid));assert.equal(notice.data.type,'bookingRequested');
  assert.equal(notice.data.sourceId,booking.id);assert.equal(notice.data.userId,fixture.driverUid);
  assert.equal(notice.data.title,'Nouvelle demande de réservation');
  assert.equal(notice.data.body,'Une nouvelle demande de réservation attend votre réponse.');
  assert.deepEqual(Object.keys(notice.data).sort(),['body','createdAt',...(index>=3?['readAt']:[]),'read','sourceId','title','type','userId'].sort());
  assert.equal(notice.data.read,index>=3);assert(millis(notice.data.createdAt)>0);
  if(index>=3) assert(millis(notice.data.readAt)>=millis(notice.data.createdAt));
  assert.equal(state.trip.seatsAvailable,4);assert.equal(state.trip.priceCents,0);assert.equal(state.trip.status,'published');
  assert(state.pendingRequestIds.includes(booking.id));
  for(const [actor,expected] of [['parent',0],['driver',1],['outsider',0]]) {
    assert.equal(state.inboxes[actor].length,expected);
    if(expected) {assert.equal(state.inboxes[actor][0].id,notice.id);assert.equal(state.inboxes[actor][0].unread,index<3);}
  }
  const additions={bookings:booking.id,notifications:notice.id,bookingRequestReceipts:receipt.id};
  const documents=Object.fromEntries(Object.entries(state.records.documents).map(([name,rows])=>
    [name,rows.filter(row=>row.id!==additions[name])]));
  for(const name of Object.keys(additions)) if(!Object.hasOwn(baseline.documents,name) && documents[name]?.length===0) delete documents[name];
  assert.deepEqual({...state.records,documents},baseline,'Only the new booking, receipt and driver notice may be added');
  for(const [collection,row] of [['bookings',booking],['notifications',notice],['bookingRequestReceipts',receipt]])
    assert.deepEqual(state.records.documents[collection].find(item=>item.id===row.id),row);
  return {phase,bookingId:booking.id,noticeId:notice.id,receiptId:receipt.id,protectedRecordCount,
    requestExists:true,noticeRead:index>=3,readAtMillis:index>=3?millis(notice.data.readAt):null,
    accountsIsolated:true,capacityUnchanged:true,physicalUiProven:false,pushDeliveryProven:false};
}
