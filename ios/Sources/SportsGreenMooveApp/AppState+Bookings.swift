import Foundation

extension AppState {
    var tripActionBusy: Bool {
        bookingBusy || ((selectedRole == .driver || selectedRole == .child) && (rideRequests.busy || locationWorkUnsettled))
    }

    func handleTripAction(trip: TripSummary, access: AccountAccess) async {
        guard access.isCurrent else { return }
        switch access.context.role {
        case .driver: requestActiveRideStart(tripId: trip.id)
        case .child: requestActiveRideTracking()
        case .parent: await requestBooking(trip: trip, childId: nil, seats: 1, access: access)
        case .clubManager, .admin: return
        }
    }

    func requestBooking(trip: TripSummary, childId: String?, seats: Int) async {
        guard let access = accountAccess else { return }
        await requestBooking(trip: trip, childId: childId, seats: seats, access: access)
    }

    func requestBooking(trip: TripSummary, childId: String?, seats: Int, access: AccountAccess) async {
        guard !bookingBusy, access.context.role == .parent, access.context.grantedRoles.contains(.parent),
              let work = access.begin() else { return }
        bookingBusy = true
        errorMessage = nil; noticeMessage = nil
        defer { bookingBusy = false; access.finish(work) }
        do {
            let bookingId = try await firebase.requestBooking(uid: access.context.uid, trip: trip, childId: childId, seats: seats)
            try access.requireCurrent(work)
            noticeMessage = "Demande envoyée: \(bookingId)"
        } catch {
            guard access.owns(work) else { return }
            if error is BookingReviewRequiredError { searchMatches.removeAll { $0.summary == trip } }
            errorMessage = error.localizedDescription
        }
    }

    func approveBooking(_ request: BookingRequestSummary) async {
        guard let access = accountAccess else { return }
        await approveBooking(request, access: access)
    }

    func approveBooking(_ request: BookingRequestSummary, access: AccountAccess) async {
        guard !bookingBusy, access.context.role == .driver, access.context.grantedRoles.contains(.driver),
              let work = access.begin() else { return }
        bookingBusy = true
        errorMessage = nil; noticeMessage = nil
        defer { bookingBusy = false; access.finish(work) }
        do {
            let status = try await firebase.approveBooking(uid: access.context.uid, bookingId: request.bookingId)
            try access.requireCurrent(work)
            guard status == "approved" else {
                throw ProviderConfigurationError(message: "La réservation n'a pas été approuvée.")
            }
            noticeMessage = "Demande approuvée."
            await refreshAppData(access: access)
        } catch {
            guard access.owns(work) else { return }
            errorMessage = error.localizedDescription
        }
    }
}
