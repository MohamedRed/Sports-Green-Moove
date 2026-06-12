import Foundation

extension AppState {
    func markPickup(_ passenger: RidePassengerStatus) async {
        await markPassenger(passenger, pickup: true)
    }

    func markDropoff(_ passenger: RidePassengerStatus) async {
        await markPassenger(passenger, pickup: false)
    }

    func endActiveRide() async {
        guard let ride = activeRide else { return }
        loading = true
        defer { loading = false }
        do {
            let completion = try await endTrackedRide(
                firebase: firebase,
                radar: radar,
                rideSessionId: ride.rideSessionId,
                distanceMeters: activeRideTrip?.distanceMetersFromLabel() ?? 0,
                passengersSharing: max(ride.passengers.count, 1)
            )
            activeRide = nil
            activeRideTrip = nil
            overlay = nil
            selectedTab = .trips
            noticeMessage = "Course terminée · \(String(format: "%.1f", completion.co2SavedKg)) kg CO₂ · \(completion.rewardLabel)"
            await refreshAppData()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startRide(tripId: String) async {
        do {
            let trip = trips.first { $0.id == tripId }
            let result = try await startTrackedRide(
                firebase: firebase,
                radar: radar,
                tripId: tripId,
                role: selectedRole,
                bookingIds: approvedBookingIds(for: tripId)
            )
            activeRide = result.ride
            activeRideTrip = trip
            noticeMessage = result.notice
            selectedTab = .trips
            overlay = .ride
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func markPassenger(_ passenger: RidePassengerStatus, pickup: Bool) async {
        guard let ride = activeRide else { return }
        loading = true
        defer { loading = false }
        do {
            if pickup {
                _ = try await firebase.markPickup(
                    rideSessionId: ride.rideSessionId,
                    bookingId: passenger.bookingId,
                    childId: passenger.childId
                )
                noticeMessage = "Pickup confirmé."
            } else {
                _ = try await firebase.markDropoff(
                    rideSessionId: ride.rideSessionId,
                    bookingId: passenger.bookingId,
                    childId: passenger.childId
                )
                noticeMessage = "Dropoff confirmé."
            }
            activeRide = try await firebase.getActiveRide()
        } catch {
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
