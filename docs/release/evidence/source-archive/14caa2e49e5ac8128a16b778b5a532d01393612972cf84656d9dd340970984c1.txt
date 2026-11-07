import Foundation

#if DEBUG
actor UITestParentReservations: ParentReservationGateway {
    private var cancelled = false
    func parentReservations(uid: String, cursor: String?) async throws -> ParentReservationPage {
        guard uid == "ui-user", cursor == nil || cursor == "second" else { throw ParentReservationError.invalidResponse }
        if cursor == nil { return .init(userId: uid, items: [], cursor: "second") }
        return .init(userId: uid, items: [.init(id: "parent-reservation", tripId: "trip-1", parentUid: uid,
            childLabel: "Nora", seats: 2, status: cancelled ? .cancelled : .requested,
            title: "Trajet enfant", club: "Club Démo", date: "Demain", time: "16h45", price: "4,00 EUR",
            canCancel: !cancelled, refundPending: false, tripChangeId: nil)], cursor: nil)
    }
    func cancelParentReservation(uid: String, bookingId: String) async throws -> ParentCancellationReceipt {
        guard uid == "ui-user", bookingId == "parent-reservation", !cancelled else { throw ParentReservationError.invalidResponse }
        cancelled = true; return .init(bookingId: bookingId)
    }
}
extension UITestFirebaseGateway {
    func parentReservations(uid: String, cursor: String?) async throws -> ParentReservationPage {
        try await reservationsFixture.parentReservations(uid: uid, cursor: cursor)
    }
    func cancelParentReservation(uid: String, bookingId: String) async throws -> ParentCancellationReceipt {
        try await reservationsFixture.cancelParentReservation(uid: uid, bookingId: bookingId)
    }
}
#endif
