#!/usr/bin/env node
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'sports-green-moove-dev';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= '127.0.0.1:9000';

if (getApps().length === 0) initializeApp({
  projectId,
  databaseURL: `http://127.0.0.1:9000/?ns=${projectId}-default-rtdb`,
});

const auth = getAuth();
const db = getFirestore();
const rtdb = getDatabase();
const now = Timestamp.now();
const departure = Timestamp.fromDate(new Date(Date.now() + 36 * 60 * 60 * 1000));

const qa = {
  password: 'QaPass12345',
  parent: {
    uid: 'sgm-qa-parent',
    email: 'p@example.test',
    displayName: 'Hermes Parent QA',
    roles: ['parent'],
  },
  driver: {
    uid: 'sgm-qa-driver',
    email: 'd@example.test',
    displayName: 'Hermes Driver QA',
    roles: ['driver', 'parent'],
  },
  clubManager: {
    uid: 'sgm-qa-club-manager',
    email: 'c@example.test',
    displayName: 'Hermes Club QA',
    roles: ['clubManager', 'parent'],
  },
  child: {
    id: 'sgm-qa-child-lina',
    displayName: 'Lina QA',
  },
  clubId: 'sgm-qa-club-green-wavre',
  teamId: 'sgm-qa-club-green-wavre-u8',
  tripId: 'sgm-qa-trip-u8-wavre-bruxelles',
  bookingRequestedId: 'sgm-qa-booking-requested',
  bookingApprovedId: 'sgm-qa-booking-approved',
};

const roleMap = (roles) => ({
  admin: roles.includes('admin'),
  child: roles.includes('child'),
  clubManager: roles.includes('clubManager'),
  driver: roles.includes('driver'),
  parent: roles.includes('parent'),
});

async function upsertUser(user) {
  try {
    await auth.deleteUser(user.uid);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  await auth.createUser({
    uid: user.uid,
    email: user.email,
    password: qa.password,
    displayName: user.displayName,
    emailVerified: true,
  });
  await auth.setCustomUserClaims(user.uid, { roleKeys: user.roles });
  await db.collection('users').doc(user.uid).set({
    email: user.email,
    displayName: user.displayName,
    roles: roleMap(user.roles),
    driverVerified: user.roles.includes('driver'),
    verified: true,
    stripeStatus: user.roles.includes('driver') ? 'test_ready' : null,
    updatedAt: now,
    createdAt: now,
  }, { merge: true });
}

async function seed() {
  await Promise.all([upsertUser(qa.parent), upsertUser(qa.driver), upsertUser(qa.clubManager)]);

  await db.collection('clubs').doc(qa.clubId).set({
    name: 'Green Wavre QA Club',
    sport: 'Football',
    primarySport: 'Football',
    status: 'public',
    memberCount: 3,
    memberInitials: ['HP', 'HD', 'HC'],
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  await db.collection('teams').doc(qa.teamId).set({
    clubId: qa.clubId,
    name: 'U 7/8 QA',
    category: 'U 7/8',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  for (const [uid, role] of [
    [qa.parent.uid, 'parent'],
    [qa.driver.uid, 'driver'],
    [qa.clubManager.uid, 'clubManager'],
  ]) {
    await db.collection('memberships').doc(`${uid}_${qa.clubId}`).set({
      userId: uid,
      clubId: qa.clubId,
      teamIds: [qa.teamId],
      role,
      status: 'active',
      approvedAt: now,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });
  }

  await db.collection('children').doc(qa.child.id).set({
    displayName: qa.child.displayName,
    firstName: 'Lina',
    guardianUserIds: [qa.parent.uid],
    clubId: qa.clubId,
    teamId: qa.teamId,
    category: 'U 7/8',
    consent: { guardian: true, childTracking: true, updatedAt: now },
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  await db.collection('memberships').doc(`${qa.child.id}_${qa.clubId}`).set({
    userId: qa.child.id,
    childUserId: qa.child.id,
    guardianUserId: qa.parent.uid,
    clubId: qa.clubId,
    teamIds: [qa.teamId],
    role: 'child',
    status: 'active',
    approvedAt: now,
    updatedAt: now,
    createdAt: now,
  }, { merge: true });

  await db.collection('trips').doc(qa.tripId).set({
    driverUserId: qa.driver.uid,
    status: 'published',
    title: 'U 7/8 · Green Wavre QA Club',
    sport: 'Football',
    clubName: 'Green Wavre QA Club',
    teamName: 'U 7/8 QA',
    clubId: qa.clubId,
    teamId: qa.teamId,
    category: 'U 7/8',
    departureAt: departure,
    arrivalBy: Timestamp.fromDate(new Date(departure.toMillis() + 75 * 60 * 1000)),
    origin: { lat: 50.7167, lng: 4.6167 },
    destination: { lat: 50.8503, lng: 4.3517 },
    pickupRadiusM: 1500,
    seatsTotal: 4,
    seatsAvailable: 2,
    baggage: 'medium',
    returnTrip: true,
    priceCents: 350,
    driverRating: 4.8,
    driverVerified: true,
    supportsVehicleTracking: true,
    supportsChildTracking: true,
    co2SavedKgEstimate: 7.4,
    distanceKm: 28.6,
    passengerInitials: ['LQ'],
    regionGeohash: 'u15',
    blockedUserIds: [],
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  await db.collection('stripeAccounts').doc(qa.driver.uid).set({
    userId: qa.driver.uid,
    stripeAccountId: 'acct_sgm_qa_emulator',
    payoutsEnabled: true,
    accountVersion: 'v1-express-emulator',
    updatedAt: now,
  }, { merge: true });

  await db.collection('bookings').doc(qa.bookingRequestedId).set({
    tripId: qa.tripId,
    parentUserId: qa.parent.uid,
    requesterUserId: qa.parent.uid,
    driverUserId: qa.driver.uid,
    childId: qa.child.id,
    childLabel: qa.child.displayName,
    seats: 1,
    status: 'requested',
    paymentStatus: 'not_required',
    note: 'Fixture: pending approval request',
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  await db.collection('bookings').doc(qa.bookingApprovedId).set({
    tripId: qa.tripId,
    parentUserId: qa.parent.uid,
    requesterUserId: qa.parent.uid,
    driverUserId: qa.driver.uid,
    childId: qa.child.id,
    childLabel: qa.child.displayName,
    seats: 1,
    status: 'approved',
    paymentStatus: 'required',
    note: 'Fixture: approved booking for ride/payment screens',
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  await db.collection('notifications').doc('sgm-qa-parent-booking-approved').set({
    userId: qa.parent.uid,
    type: 'bookingApproved',
    title: 'Réservation approuvée',
    body: 'Le conducteur QA a approuvé votre trajet.',
    sourceId: qa.bookingApprovedId,
    read: false,
    createdAt: now,
  }, { merge: true });

  await db.collection('messages').doc('sgm-qa-chat-booking').set({
    senderUserId: qa.driver.uid,
    participantUserIds: [qa.parent.uid, qa.driver.uid],
    sourceType: 'booking',
    sourceId: qa.bookingApprovedId,
    body: 'Bonjour, le point de rendez-vous QA est confirmé.',
    createdAt: now,
  }, { merge: true });

  await db.collection('co2Ledger').doc('sgm-qa-co2-parent').set({
    userId: qa.parent.uid,
    rideSessionId: 'sgm-qa-historical-ride',
    co2SavedKg: 3.2,
    sharedDistanceKm: 14,
    rideCount: 1,
    createdAt: now,
  }, { merge: true });

  await db.collection('rewardLedger').doc('sgm-qa-reward-driver').set({
    userId: qa.driver.uid,
    rideSessionId: 'sgm-qa-historical-ride',
    amountCents: 250,
    type: 'earned',
    createdAt: now,
  }, { merge: true });

  await rtdb.ref('liveTrips').remove();

  const summary = {
    projectId,
    authEmulator: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    firestoreEmulator: process.env.FIRESTORE_EMULATOR_HOST,
    parentEmail: qa.parent.email,
    driverEmail: qa.driver.email,
    clubManagerEmail: qa.clubManager.email,
    password: qa.password,
    tripId: qa.tripId,
    requestedBookingId: qa.bookingRequestedId,
    approvedBookingId: qa.bookingApprovedId,
  };
  console.log(JSON.stringify(summary, null, 2));
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
