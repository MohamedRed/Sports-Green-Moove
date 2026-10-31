export function tripInput() {
  const departure = new Date(Date.now() + 36 * 3600_000);
  return { title: 'Local QA trip', sport: 'Football', clubName: 'Green Wavre QA Club',
    clubId: 'sgm-qa-club-green-wavre', teamId: 'sgm-qa-club-green-wavre-u8', category: 'U 7/8',
    departureAt: departure.toISOString(), origin: { lat: 50.7167, lng: 4.6167 },
    destination: { lat: 50.8503, lng: 4.3517 }, pickupRadiusM: 1500,
    seatsTotal: 4, seatsAvailable: 4, baggage: 'medium', returnTrip: false, priceCents: 0,
    supportsVehicleTracking: true, supportsChildTracking: true, co2SavedKgEstimate: 7.4 };
}
