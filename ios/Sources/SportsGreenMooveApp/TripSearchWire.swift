import Foundation
import CoreFoundation

enum TripSearchWire {
    static func matches(_ value: Any, seatsNeeded: Int) throws -> [TripMatchSummary] {
        guard (1...8).contains(seatsNeeded), let envelope = value as? [String: Any],
              let rows = envelope["matches"] as? [[String: Any]], rows.count <= 12 else { throw invalid() }
        let matches = try rows.map { try match($0, seatsNeeded: seatsNeeded) }
        guard Set(matches.map(\.tripId)).count == matches.count else { throw invalid() }
        return matches
    }

    private static func match(_ row: [String: Any], seatsNeeded: Int) throws -> TripMatchSummary {
        let id = try string(row["tripId"], max: 256)
        guard validID(id), let data = row["summary"] as? [String: Any],
              try string(data["id"], max: 256) == id,
              let intentData = data["bookingIntent"] as? [String: Any],
              let intent = BookingIntentSnapshot.fromPayload(intentData), seatsNeeded <= intent.context.seatsTotal,
              let status = TripStatus(rawValue: try string(data["status"], max: 20)) else { throw invalid() }
        let seats = try integer(data["seatsAvailable"], range: seatsNeeded...intent.context.seatsTotal)
        let seatsLabel = try string(data["seatsLabel"], max: 80)
        guard seatsLabel == "\(seats) \(seats > 1 ? "places" : "place")" else { throw invalid() }
        let priceLabel = try string(data["priceLabel"], max: 80)
        guard priceLabel == price(intent.terms.priceCents) else { throw invalid() }
        guard let route = row["route"] as? [String: Any] else { throw invalid() }
        let detour = try integer(route["detourDurationSeconds"], range: 0...9_007_199_254_740_991)
        let pickup = try integer(route["pickupDistanceMeters"], range: 0...9_007_199_254_740_991)
        let summary = TripSummary(id: id, title: try string(data["title"], max: 1_000),
            club: try string(data["club"], max: 1_000), category: try string(data["category"], max: 80, empty: true),
            sport: try string(data["sport"], max: 1_000), departureLabel: try string(data["departureLabel"], max: 1_000),
            dateLabel: try string(data["dateLabel"], max: 1_000), timeLabel: try string(data["timeLabel"], max: 100),
            distanceLabel: try string(data["distanceLabel"], max: 100), seatsAvailable: seats, seatsLabel: seatsLabel,
            priceLabel: priceLabel, passengerInitials: try strings(data["passengerInitials"], max: 100),
            reasons: try strings(data["reasons"], max: 100), status: status,
            mapPreview: try preview(data["mapPreview"], route: route, intent: intent), bookingIntent: intent)
        let score = try number(row["score"])
        guard score > 0 else { throw invalid() }
        return TripMatchSummary(tripId: id, score: score, summary: summary,
            reasons: try strings(row["reasons"], max: 100),
            detourMinutes: Int((Double(detour) / 60).rounded()), pickupDistanceMeters: pickup)
    }

    private static func preview(_ value: Any?, route: [String: Any], intent: BookingIntentSnapshot) throws -> MapRoutePreview {
        guard let row = value as? [String: Any] else { throw invalid() }
        let start = try point(row["start"]), end = try point(row["end"])
        guard start == intent.terms.origin, end == intent.terms.destination else { throw invalid() }
        let encoded = try optionalPolyline(row["encodedPolyline"])
        let finalEncoded = try optionalPolyline(route["finalEncodedPolyline"])
        guard finalEncoded == nil || finalEncoded == encoded else { throw invalid() }
        return MapRoutePreview(start: start, end: end, encodedPolyline: encoded)
    }

    private static func optionalPolyline(_ value: Any?) throws -> String? {
        guard let value else { return nil }
        guard let encoded = value as? String, EncodedRouteValidation.isValid(encoded) else { throw invalid() }
        return encoded
    }

    private static func point(_ value: Any?) throws -> MapPoint {
        guard let row = value as? [String: Any] else { throw invalid() }
        let lat = try number(row["lat"]), lng = try number(row["lng"])
        guard (-90...90).contains(lat), (-180...180).contains(lng) else { throw invalid() }
        return MapPoint(lat: lat, lng: lng)
    }

    private static func number(_ value: Any?) throws -> Double {
        guard let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID(), value.doubleValue.isFinite else { throw invalid() }
        return value.doubleValue
    }

    private static func integer(_ value: Any?, range: ClosedRange<Int>) throws -> Int {
        let value = try number(value)
        guard value.rounded(.towardZero) == value, value >= Double(range.lowerBound), value <= Double(range.upperBound) else { throw invalid() }
        return Int(value)
    }

    private static func string(_ value: Any?, max: Int, empty: Bool = false) throws -> String {
        guard let value = value as? String, value.utf16.count <= max,
              empty || !TeamChatText.normalized(value).isEmpty else { throw invalid() }
        return value
    }

    private static func strings(_ value: Any?, max: Int) throws -> [String] {
        guard let values = value as? [String], values.count <= max else { throw invalid() }
        for value in values { _ = try string(value, max: 1_000) }
        return values
    }

    private static func validID(_ value: String) -> Bool {
        !value.contains("/") && ![".", ".."].contains(value) && !(value.hasPrefix("__") && value.hasSuffix("__"))
    }

    private static func price(_ cents: Int) -> String {
        if cents == 0 { return "Gratuit" }
        let remainder = String(cents % 100)
        return "\(cents / 100),\(remainder.count == 1 ? "0" : "")\(remainder) EUR"
    }

    private static func invalid() -> ProviderConfigurationError {
        ProviderConfigurationError(message: "Impossible de vérifier les trajets. Réessayez.")
    }
}
