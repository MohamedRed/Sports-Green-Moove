import Foundation

protocol AppDataGateway: Sendable {
    func searchTrips() async throws -> [TripSummary]
    func listChildren() async throws -> [ChildSummary]
    func listClubSummaries() async throws -> [ClubSummary]
    func getActiveRide() async throws -> LiveRideSnapshot?
    func getPayableBookings() async throws -> [PayableBookingSummary]
    func getImpactSummary() async throws -> ImpactSummary
    func getRewardSummary() async throws -> RewardSummary
    func getDriverBookingRequests() async throws -> [BookingRequestSummary]
}

struct AppDataSnapshot: Sendable {
    let trips: [TripSummary]
    let children: [ChildSummary]
    let clubs: [ClubSummary]
    let ride: LiveRideSnapshot?
    let payable: [PayableBookingSummary]
    let impact: ImpactSummary
    let rewards: RewardSummary
    let requests: [BookingRequestSummary]
}

@MainActor
func loadAppData(
    from gateway: AppDataGateway,
    role: AppRole,
    requireCurrent: () throws -> Void
) async throws -> AppDataSnapshot {
    try requireCurrent()
    let trips = try await gateway.searchTrips()
    try requireCurrent()
    let children = role == .parent ? try await gateway.listChildren() : []
    try requireCurrent()
    let clubs = try await gateway.listClubSummaries()
    try requireCurrent()
    let ride = try await gateway.getActiveRide()
    try requireCurrent()
    let payable = try await gateway.getPayableBookings()
    try requireCurrent()
    let impact = try await gateway.getImpactSummary()
    try requireCurrent()
    let rewards = try await gateway.getRewardSummary()
    try requireCurrent()
    let requests = role == .driver ? try await gateway.getDriverBookingRequests() : []
    try requireCurrent()
    return AppDataSnapshot(trips: trips, children: children, clubs: clubs, ride: ride,
        payable: payable, impact: impact, rewards: rewards, requests: requests)
}
