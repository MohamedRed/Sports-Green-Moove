import Foundation

extension UnconfiguredFirebaseGateway {
    func parentReservations(uid: String, cursor: String?) async throws -> ParentReservationPage { throw ParentReservationError.unavailable }
    func cancelParentReservation(uid: String, bookingId: String) async throws -> ParentCancellationReceipt { throw ParentReservationError.unavailable }
}
