import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { call, db, denied, document, tripInput, viewedBooking } from './local-flow-client.mjs';

export async function checkBookingRequestNotices(parent, driver, outsider) {
  const steps = [], observations = [], persisted = [];
  const check = async (id, action) => { await action(); steps.push({id, status:'passed'}); };
  const fresh = async () => {
    const {tripId} = await call('createTrip', driver, {...tripInput(), title:'Demande et alerte QA'});
    return {tripId, input:await viewedBooking(parent, {tripId,seats:2,note:'Note privée QA'})};
  };
  const notices = async bookingId => (await db.collection('notifications').where('sourceId','==',bookingId).get()).docs;
  const bookings = async tripId => (await db.collection('bookings').where('tripId','==',tripId).get()).docs;
  const noticeId = bookingId => 'bookingDecision_' + createHash('sha256').update(JSON.stringify(['bookingRequested',bookingId,driver.uid])).digest('hex');
  async function assertRequest(tripId, bookingId, input) {
    const rows = await notices(bookingId); assert.equal(rows.length,1);
    const notice = rows[0]; assert.equal(notice.id,noticeId(bookingId));
    assert.deepEqual(Object.keys(notice.data()).sort(),['body','createdAt','read','sourceId','title','type','userId']);
    assert.equal(notice.get('type'),'bookingRequested'); assert.equal(notice.get('sourceId'),bookingId);
    assert.equal(notice.get('userId'),driver.uid); assert.equal(notice.get('read'),false);
    assert.equal(notice.get('title'),'Nouvelle demande de réservation');
    assert.equal(notice.get('body'),'Une nouvelle demande de réservation attend votre réponse.');
    assert.equal(typeof notice.get('createdAt')?.toMillis(),'number');
    const booking = await document('bookings',bookingId), trip = await document('trips',tripId);
    assert.equal(booking.status,'requested'); assert.equal(booking.parentUserId,parent.uid);
    assert.equal(booking.seats,input.seats); assert.equal(trip.seatsAvailable,4);
    const receipts = (await db.collection('bookingRequestReceipts').where('response.bookingId','==',bookingId).get()).docs;
    assert.equal(receipts.length,1); assert.equal(receipts[0].get('state'),'committed');
    assert.equal(receipts[0].get('clientRequestId'),input.clientRequestId); assert.equal(receipts[0].get('uid'),parent.uid);
    persisted.push({kind:'request-commit',bookingId,tripId,noticeId:notice.id,notice:notice.data(),
      booking:{tripId:booking.tripId,parentUserId:booking.parentUserId,driverUserId:booking.driverUserId,seats:booking.seats,status:booking.status},
      receipt:{id:receipts[0].id,uid:receipts[0].get('uid'),clientRequestId:receipts[0].get('clientRequestId'),
        state:receipts[0].get('state'),bookingId:receipts[0].get('response.bookingId')},seatsAvailable:trip.seatsAvailable});
    return notice;
  }
  let first;
  await check('request-commits-one-private-driver-notice-with-booking-and-receipt',async () => {
    first = await fresh(); first.response = await call('requestBooking',parent,first.input);
    await assertRequest(first.tripId,first.response.bookingId,first.input);
    const queue = (await call('listDriverBookingRequests',driver)).bookings.filter(row=>row.bookingId===first.response.bookingId);
    assert.equal(queue.length,1); assert.equal(queue[0].status,'requested');
  });
  await check('request-notice-is-visible-only-in-the-drivers-inbox',async () => {
    const id = noticeId(first.response.bookingId);
    for (const actor of [parent,driver,outsider]) {
      const rows = (await call('getInbox',actor)).inbox.notifications.filter(row=>row.id===id);
      assert.equal(rows.length,actor.uid===driver.uid?1:0);
      if(rows.length) assert.equal(rows[0].unread,true);
      observations.push({actor:actor.uid,visibleRequestNotices:rows.length});
    }
    await denied('markNotificationRead',parent,{userId:parent.uid,notificationId:id},'NOT_FOUND');
    await denied('markNotificationRead',outsider,{userId:outsider.uid,notificationId:id},'NOT_FOUND');
    assert.equal((await notices(first.response.bookingId))[0].get('read'),false);
  });
  await check('request-replay-preserves-one-notice-and-its-confirmed-read-time',async () => {
    const bookingId=first.response.bookingId,id=noticeId(bookingId);
    await call('markNotificationRead',driver,{userId:driver.uid,notificationId:id});
    const before=(await notices(bookingId))[0].data(); assert.equal(before.read,true); assert(before.readAt);
    const response=await call('requestBooking',parent,first.input);
    assert.equal(response.bookingId,bookingId); assert.equal(response.reused,true);
    const rows=await notices(bookingId); assert.equal(rows.length,1); assert.deepEqual(rows[0].data(),before);
    persisted.push({kind:'request-read-replay',bookingId,noticeId:id,beforeNotice:before,afterNotice:rows[0].data()});
    assert.equal((await bookings(first.tripId)).length,1);
    assert.equal((await document('bookings',bookingId)).status,'requested');
    assert.equal((await document('trips',first.tripId)).seatsAvailable,4);
    assert.equal((await call('getInbox',driver)).inbox.notifications.find(row=>row.id===id).unread,false);
  });
  await check('concurrent-request-retries-commit-one-booking-receipt-and-driver-notice',async () => {
    const {tripId,input}=await fresh();
    const replies=await Promise.all([call('requestBooking',parent,input),call('requestBooking',parent,input),call('requestBooking',parent,input)]);
    assert.equal(new Set(replies.map(row=>row.bookingId)).size,1);
    assert.equal(replies.filter(row=>row.reused===false).length,1);
    assert.equal((await bookings(tripId)).length,1); await assertRequest(tripId,replies[0].bookingId,input);
  });
  await check('conflicting-request-reuse-does-not-change-the-booking-or-notice',async () => {
    const id=first.response.bookingId,before=(await notices(id))[0].data(),booking=await document('bookings',id);
    await denied('requestBooking',parent,{...first.input,seats:1},'ALREADY_EXISTS');
    assert.deepEqual((await notices(id))[0].data(),before); assert.deepEqual(await document('bookings',id),booking);
    assert.equal((await bookings(first.tripId)).length,1);
  });
  await check('separate-fresh-requests-retain-separate-notice-identities',async () => {
    const {tripId,input}=await fresh(),other=await viewedBooking(parent,{tripId,seats:1});
    const a=await call('requestBooking',parent,input),b=await call('requestBooking',parent,other);
    assert.notEqual(a.bookingId,b.bookingId); assert.equal((await bookings(tripId)).length,2);
    assert.notEqual((await assertRequest(tripId,a.bookingId,input)).id,(await assertRequest(tripId,b.bookingId,other)).id);
  });
  await check('denied-stale-and-abandoned-requests-never-create-a-driver-notice',async () => {
    const {tripId,input}=await fresh(),before=(await db.collection('notifications').get()).size;
    await denied('requestBooking',null,input,'UNAUTHENTICATED');
    await denied('requestBooking',parent,{...input,requesterUserId:driver.uid},'PERMISSION_DENIED');
    await denied('requestBooking',parent,{...input,childId:'sgm-qa-missing-child'},'PERMISSION_DENIED');
    await db.collection('trips').doc(tripId).update({priceCents:999});
    await denied('requestBooking',parent,input,'ABORTED');
    const current=await viewedBooking(parent,{tripId,seats:1});
    const resolved=await call('resolveBookingRequest',parent,{clientRequestId:current.clientRequestId,requesterUserId:parent.uid});
    assert.equal(resolved.state,'abandoned'); await denied('requestBooking',parent,current,'FAILED_PRECONDITION');
    assert.equal((await bookings(tripId)).length,0); assert.equal((await db.collection('notifications').get()).size,before);
  });
  await check('request-resolution-races-never-leave-an-orphan-or-duplicate-notice',async () => {
    for(let iteration=0;iteration<4;iteration++) {
      const {tripId,input}=await fresh(),before=(await db.collection('notifications').get()).size;
      const [sent,resolved]=await Promise.allSettled([call('requestBooking',parent,input),
        call('resolveBookingRequest',parent,{clientRequestId:input.clientRequestId,requesterUserId:parent.uid})]);
      assert.equal(resolved.status,'fulfilled'); const rows=await bookings(tripId);
      if(resolved.value.state==='committed') {
        assert.equal(sent.status,'fulfilled'); assert.equal(rows.length,1);
        assert.equal(sent.value.bookingId,resolved.value.bookingId); await assertRequest(tripId,sent.value.bookingId,input);
      } else {
        assert.equal(resolved.value.state,'abandoned'); assert.equal(sent.status,'rejected');
        assert.equal(sent.reason.code,'FAILED_PRECONDITION'); assert.equal(rows.length,0);
      }
      assert.equal((await db.collection('notifications').get()).size,before+rows.length);
    }
  });
  return {steps,observations,persisted};
}
