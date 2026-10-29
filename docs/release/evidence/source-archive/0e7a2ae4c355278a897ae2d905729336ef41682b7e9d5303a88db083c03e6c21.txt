import Foundation

struct BookingIntentSnapshot: Codable, Hashable, Sendable {
    struct Terms: Codable, Hashable, Sendable {
        let departureAt: String
        let arrivalBy: String?
        let origin: MapPoint
        let destination: MapPoint
        let priceCents: Int
    }
    struct Context: Codable, Hashable, Sendable {
        let driverUserId: String
        let seatsTotal: Int
        let clubId: String?
        let teamId: String?
        let category: String?
        let pickupRadiusM: Int?
        let baggage: String?
        let returnTrip: Bool?
        let supportsVehicleTracking: Bool?
        let supportsChildTracking: Bool?
        let appliedChangeId: String?
    }
    let terms: Terms
    let context: Context

    static func fromTripData(_ data: [String: Any]) -> Self? {
        let terms = ["departureAt", "arrivalBy", "origin", "destination", "priceCents"]
        let context = ["driverUserId", "seatsTotal", "clubId", "teamId", "category", "pickupRadiusM", "baggage",
            "returnTrip", "supportsVehicleTracking", "supportsChildTracking", "appliedChangeId"]
        var values = data
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        for field in ["departureAt", "arrivalBy"] {
            if let date = values[field] as? Date { values[field] = formatter.string(from: date) }
        }
        return fromPayload([
            "terms": Dictionary(uniqueKeysWithValues: terms.map { ($0, values[$0] ?? NSNull()) }),
            "context": Dictionary(uniqueKeysWithValues: context.map { ($0, data[$0] ?? NSNull()) }),
        ])
    }

    static func fromPayload(_ payload: [String: Any]) -> Self? {
        guard let json = try? JSONSerialization.data(withJSONObject: payload),
              let result = try? JSONDecoder().decode(Self.self, from: json), result.isValid else { return nil }
        return result
    }

    func callablePayload() throws -> [String: Any] {
        guard isValid else { throw BookingIntentError.unavailable }
        guard var payload = try JSONSerialization.jsonObject(with: JSONEncoder().encode(self)) as? [String: Any],
              var terms = payload["terms"] as? [String: Any] else {
            throw BookingIntentError.unavailable
        }
        terms["arrivalBy"] = self.terms.arrivalBy as Any? ?? NSNull()
        payload["terms"] = terms
        return payload
    }

    var isValid: Bool {
        guard let departure = Self.date(terms.departureAt), (0...100_000).contains(terms.priceCents),
              Self.validPoint(terms.origin), Self.validPoint(terms.destination),
              Self.validId(context.driverUserId), (1...8).contains(context.seatsTotal) else { return false }
        if let arrival = terms.arrivalBy, Self.date(arrival).map({ $0 >= departure }) != true { return false }
        if let club = context.clubId, !Self.validId(club) { return false }
        if let team = context.teamId, !Self.validId(team) { return false }
        if let category = context.category, category.count > 80 { return false }
        if let radius = context.pickupRadiusM, !(100...10_000).contains(radius) { return false }
        if let baggage = context.baggage, !["small", "medium", "large"].contains(baggage) { return false }
        if let revision = context.appliedChangeId, revision.range(of: "^[a-f0-9]{64}$", options: .regularExpression) == nil { return false }
        return true
    }

    private static func date(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = value.contains(".") ? [.withInternetDateTime, .withFractionalSeconds] : [.withInternetDateTime]
        return formatter.date(from: value)
    }
    private static func validPoint(_ point: MapPoint) -> Bool {
        point.lat.isFinite && point.lng.isFinite && (-90...90).contains(point.lat) && (-180...180).contains(point.lng)
    }
    private static func validId(_ value: String) -> Bool {
        !value.isEmpty && value.count <= 256 && !value.contains("/") && ![".", ".."].contains(value) &&
            !(value.hasPrefix("__") && value.hasSuffix("__"))
    }
}

struct BookingReviewRequiredError: LocalizedError, Sendable {
    var errorDescription: String? { "Les détails du trajet ont changé. Relancez la recherche avant de réserver." }
}

enum BookingIntentError: LocalizedError {
    case unavailable
    var errorDescription: String? { "Les détails du trajet doivent être actualisés." }
}

func bookingRequestPayload(trip: TripSummary, childId: String?, seats: Int) throws -> [String: Any] {
    guard !trip.id.isEmpty, (1...8).contains(seats), childId == nil || childId?.isEmpty == false,
          let intent = trip.bookingIntent else {
        throw BookingIntentError.unavailable
    }
    var payload: [String: Any] = ["tripId": trip.id, "seats": seats, "expectedBookingIntent": try intent.callablePayload()]
    if let childId { payload["childId"] = childId }
    return payload
}
