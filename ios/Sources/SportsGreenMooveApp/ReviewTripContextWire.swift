import Foundation

enum ReviewTripContextWire {
    static func parse(_ row: [String: Any]) throws -> ReviewTripContext? {
        guard let raw = row["tripContext"] else { throw invalid }
        if raw is NSNull { return nil }
        guard let data = raw as? [String: Any], Set(data.keys) == ["tripId", "title", "departureAt", "departureLabel"] else { throw invalid }
        func field(_ key: String, max: Int) throws -> String {
            guard let value = data[key] as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  value.utf16.count <= max else { throw invalid }
            return value
        }
        let trip = try field("tripId", max: 1500), departure = try field("departureAt", max: 64)
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fractionalDate = parser.date(from: departure)
        parser.formatOptions = [.withInternetDateTime]
        guard !trip.contains("/"), trip != ".", trip != "..",
              fractionalDate != nil || parser.date(from: departure) != nil else { throw invalid }
        return try .init(tripId: trip, title: field("title", max: 140), departureAt: departure,
                         departureLabel: field("departureLabel", max: 120))
    }
    private static var invalid: ProviderConfigurationError { .init(message: "Détails du trajet invalides.") }
}
