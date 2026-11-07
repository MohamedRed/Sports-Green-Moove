import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
extension FirebaseBackendGateway {
    func parentReservations(uid: String, cursor: String?) async throws -> ParentReservationPage {
        _ = try ParentReservationWire.identifier(uid)
        var input: [String: String] = ["role": "parent"]
        if let cursor { _ = try ParentReservationWire.cursor(cursor); input["cursor"] = cursor }
        return try await firebaseOwnedCall(uid: uid, name: "listReservations", input: input) {
            try ParentReservationWire.page($0, uid: uid)
        }
    }
    func cancelParentReservation(uid: String, bookingId: String) async throws -> ParentCancellationReceipt {
        _ = try ParentReservationWire.identifier(uid); _ = try ParentReservationWire.identifier(bookingId)
        return try await firebaseOwnedCall(uid: uid, name: "cancelBooking", input: ["bookingId": bookingId]) {
            try ParentReservationWire.receipt($0, bookingId: bookingId)
        }
    }
}
#endif
