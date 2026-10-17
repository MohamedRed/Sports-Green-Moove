import Foundation
#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

struct FirebaseBookingRequestTransport: BookingRequestTransport {
    func submit(intent: PendingBookingIntent, uid: String, requestId: String) async throws -> BookingAcknowledgement {
        let terms = try intent.terms.callablePayload()
        var input: [String: Any] = ["tripId": intent.tripId, "seats": intent.seats, "expectedBookingIntent": terms,
            "clientRequestId": requestId, "requesterUserId": uid]
        if let child = intent.childId { input["childId"] = child }
        return try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable("requestBooking").call(input) { result, error in
                if let error {
                    let failure = error as NSError
                    if failure.domain == FunctionsErrorDomain && failure.code == FunctionsErrorCode.aborted.rawValue {
                        continuation.resume(throwing: BookingReviewRequiredError())
                    } else { continuation.resume(throwing: error) }
                } else if let payload = result?.data as? [String: Any], let bookingId = payload["bookingId"] as? String,
                          let requestId = payload["clientRequestId"] as? String, let trip = payload["trip"] as? [String: Any],
                          let tripId = trip["id"] as? String, let status = payload["status"] as? String,
                          let current = payload["currentBookingStatus"] as? String {
                    continuation.resume(returning: BookingAcknowledgement(bookingId: bookingId, requestId: requestId, tripId: tripId,
                        status: status, currentStatus: current))
                } else { continuation.resume(throwing: BookingRecoveryError.invalidReceipt) }
            }
        }
    }
    func resolve(uid: String, requestId: String) async throws -> BookingResolution {
        try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable("resolveBookingRequest")
                .call(["clientRequestId": requestId, "requesterUserId": uid]) { result, error in
                    if let error { continuation.resume(throwing: error); return }
                    guard let data = result?.data as? [String: Any], data["clientRequestId"] as? String == requestId else {
                        continuation.resume(throwing: BookingRecoveryError.invalidReceipt); return
                    }
                    if data["state"] as? String == "abandoned" { continuation.resume(returning: BookingResolution.abandoned) }
                    else if data["state"] as? String == "committed", let id = data["bookingId"] as? String, !id.isEmpty {
                        continuation.resume(returning: BookingResolution.committed(id))
                    } else { continuation.resume(throwing: BookingRecoveryError.invalidReceipt) }
                }
        }
    }
}
#endif
