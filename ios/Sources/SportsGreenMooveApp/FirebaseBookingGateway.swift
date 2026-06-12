import Foundation

#if canImport(FirebaseFunctions)
import FirebaseFunctions

extension FirebaseBackendGateway {
    func getDriverBookingRequests() async throws -> [BookingRequestSummary] {
        try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable("listDriverBookingRequests").call([:]) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let payload = result?.data as? [String: Any],
                      let bookings = payload["bookings"] as? [[String: Any]]
                else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse demandes invalide."))
                    return
                }

                continuation.resume(returning: bookings.compactMap(mapBookingRequest))
            }
        }
    }

    func approveBooking(bookingId: String) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable("approveBooking").call(["bookingId": bookingId]) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let payload = result?.data as? [String: Any],
                      let status = payload["status"] as? String
                else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse approbation invalide."))
                    return
                }

                continuation.resume(returning: status)
            }
        }
    }
}

private func mapBookingRequest(_ data: [String: Any]) -> BookingRequestSummary? {
    guard let bookingId = data["bookingId"] as? String,
          let tripId = data["tripId"] as? String
    else { return nil }

    return BookingRequestSummary(
        bookingId: bookingId,
        tripId: tripId,
        parentUserId: data["parentUserId"] as? String ?? "",
        childId: data["childId"] as? String,
        seats: intValue(data["seats"]) ?? 1,
        note: data["note"] as? String,
        status: data["status"] as? String ?? "requested",
        title: data["title"] as? String ?? "Trajet sportif",
        club: data["club"] as? String ?? "Club",
        dateLabel: data["dateLabel"] as? String ?? "DATE À CONFIRMER",
        timeLabel: data["timeLabel"] as? String ?? "--h--",
        priceLabel: data["priceLabel"] as? String ?? "Gratuit"
    )
}

private func intValue(_ value: Any?) -> Int? {
    if let int = value as? Int { return int }
    if let number = value as? NSNumber { return number.intValue }
    if let double = value as? Double { return Int(double) }
    return nil
}
#endif
