import Foundation

extension AppState {
    var refreshingAppData: Bool { appDataRefreshId != nil }

    func refreshAppData() async {
        guard let uid = session?.uid, !uid.isEmpty, !Task.isCancelled else { return }
        let role = selectedRole
        let requestId = UUID()
        appDataRefreshId = requestId
        errorMessage = nil
        defer {
            if appDataRefreshId == requestId { appDataRefreshId = nil }
        }
        func requireCurrent() throws {
            try Task.checkCancellation()
            guard appDataRefreshId == requestId, session?.uid == uid, selectedRole == role else {
                throw CancellationError()
            }
        }
        do {
            let snapshot = try await loadAppData(from: firebase, role: role, requireCurrent: requireCurrent)
            try requireCurrent()
            applyAppData(snapshot)
        } catch {
            guard !Task.isCancelled, appDataRefreshId == requestId, session?.uid == uid,
                  selectedRole == role else { return }
            errorMessage = "Impossible de charger vos données. Réessayez."
        }
    }

    private func applyAppData(_ snapshot: AppDataSnapshot) {
        trips = snapshot.trips
        children = snapshot.children
        clubSummaries = snapshot.clubs
        activeRide = snapshot.ride
        activeRideTrip = snapshot.ride?.tripId.flatMap { tripId in
            activeRideTrip?.id == tripId ? activeRideTrip : snapshot.trips.first { $0.id == tripId }
        }
        payableBookings = snapshot.payable
        impactSummary = snapshot.impact
        rewardSummary = snapshot.rewards
        driverBookingRequests = snapshot.requests
    }
}
