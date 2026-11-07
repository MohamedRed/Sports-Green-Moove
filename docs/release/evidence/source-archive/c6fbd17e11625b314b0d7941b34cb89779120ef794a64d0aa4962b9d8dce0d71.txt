import Foundation

extension AppState {
    func markPickup(_ passenger: RidePassengerStatus) async {
        await markPassenger(passenger, pickup: true)
    }

    func markDropoff(_ passenger: RidePassengerStatus) async {
        await markPassenger(passenger, pickup: false)
    }

    func endActiveRide() async {
        guard let ride = activeRide, let request = beginRideRequest() else { return }
        defer { rideRequests.finish(request) }
        do {
            let completion = try await endTrackedRide(
                firebase: firebase,
                radar: radar,
                rideSessionId: ride.rideSessionId,
                distanceMeters: activeRideTrip?.distanceMetersFromLabel() ?? 0,
                passengersSharing: max(ride.passengers.count, 1),
                requireCurrent: { try self.requireCurrentRideRequest(request) }
            )
            try requireCurrentRideRequest(request)
            activeRide = nil
            activeRideTrip = nil
            overlay = nil
            selectedTab = .trips
            noticeMessage = "Course terminée · \(String(format: "%.1f", completion.co2SavedKg)) kg CO₂ · \(completion.rewardLabel)"
            await refreshAppData()
        } catch {
            guard !Task.isCancelled, rideRequests.owns(request, uid: session?.uid, role: selectedRole) else { return }
            errorMessage = error.localizedDescription
        }
    }

    func startRideAfterPermissionGate(tripId: String) async {
        guard selectedRole == .driver, let request = beginRideRequest() else { return }
        defer { rideRequests.finish(request) }
        await runRideStart(tripId: tripId, request: request)
    }

    func startAccessibleRideTrackingAfterPermissionGate() async {
        guard selectedRole == .child, let request = beginRideRequest() else { return }
        defer { rideRequests.finish(request) }
        await runRideStart(tripId: nil, request: request)
    }

    func runRideStart(tripId: String?, request: RideRequest) async {
        do {
            try requireCurrentRideRequest(request)
            let result: ActiveRideStartResult
            if let tripId {
                result = try await startTrackedRide(firebase: firebase, radar: radar, tripId: tripId,
                    role: request.role, bookingIds: approvedBookingIds(for: tripId),
                    requireCurrent: { try self.requireCurrentRideRequest(request) })
            } else {
                result = try await startAccessibleRideTracking(firebase: firebase, radar: radar, role: request.role,
                    requireCurrent: { try self.requireCurrentRideRequest(request) })
            }
            try requireCurrentRideRequest(request)
            activeRide = result.ride
            activeRideTrip = result.ride.tripId.flatMap { tripId in trips.first { $0.id == tripId } }
            noticeMessage = result.notice
            selectedTab = .trips
            overlay = .ride
        } catch {
            guard !Task.isCancelled, rideRequests.owns(request, uid: session?.uid, role: selectedRole) else { return }
            errorMessage = error.localizedDescription
        }
    }

    private func markPassenger(_ passenger: RidePassengerStatus, pickup: Bool) async {
        guard let ride = activeRide, let request = beginRideRequest() else { return }
        defer { rideRequests.finish(request) }
        do {
            if pickup {
                _ = try await firebase.markPickup(
                    rideSessionId: ride.rideSessionId,
                    bookingId: passenger.bookingId,
                    childId: passenger.childId
                )
            } else {
                _ = try await firebase.markDropoff(
                    rideSessionId: ride.rideSessionId,
                    bookingId: passenger.bookingId,
                    childId: passenger.childId
                )
            }
            try requireCurrentRideRequest(request)
            let updated = try await firebase.getActiveRide()
            try requireCurrentRideRequest(request)
            activeRide = updated
            noticeMessage = pickup ? "Pickup confirmé." : "Dropoff confirmé."
        } catch {
            guard !Task.isCancelled, rideRequests.owns(request, uid: session?.uid, role: selectedRole) else { return }
            errorMessage = error.localizedDescription
        }
    }

    private func approvedBookingIds(for tripId: String) -> [String] {
        driverBookingRequests
            .filter { $0.tripId == tripId && $0.status == "approved" }
            .map(\.bookingId)
    }
}

private extension TripSummary {
    func distanceMetersFromLabel() -> Int {
        guard let match = distanceLabel.firstMatch(of: /\d+(?:[,.]\d+)?/) else { return 0 }
        let value = String(match.output).replacingOccurrences(of: ",", with: ".")
        guard let km = Double(value) else { return 0 }
        return Int(km * 1000)
    }
}

private extension RideCompletionSummary {
    var rewardLabel: String {
        let euros = Double(rewardCents) / 100
        return String(format: "%.2f €", euros).replacingOccurrences(of: ".", with: ",")
    }
}
