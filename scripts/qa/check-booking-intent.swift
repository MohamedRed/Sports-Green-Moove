import Foundation

@main struct BookingIntentWireCheck {
    static func main() throws {
        var cases: [[String: String]] = []
        func check(_ name: String, _ action: () throws -> Bool) throws {
            guard try action() else { throw NSError(domain: "BookingIntentWireCheck", code: 1,
                userInfo: [NSLocalizedDescriptionKey: name]) }
            cases.append(["id": name, "status": "passed"])
        }
        let terms: [String: Any] = ["departureAt": "2027-01-10T10:00:00.000Z", "arrivalBy": NSNull(),
            "origin": ["lat": 50.7, "lng": 4.6], "destination": ["lat": 50.8, "lng": 4.3], "priceCents": 250]
        let context: [String: Any] = ["driverUserId": "driver", "seatsTotal": 4, "clubId": "club", "teamId": "team",
            "category": "U8", "pickupRadiusM": 1500, "baggage": "medium", "returnTrip": false,
            "supportsVehicleTracking": true, "supportsChildTracking": true, "appliedChangeId": String(repeating: "a", count: 64)]
        let wire: [String: Any] = ["terms": terms, "context": context]
        guard let displayed = BookingIntentSnapshot.fromPayload(wire) else { fatalError("Valid fixture rejected") }
        let trip = TripSummary(id: "trip", title: "Trip", club: "Club", category: "U8", departureLabel: "10h00",
            seatsAvailable: 4, priceLabel: "2,50 EUR", reasons: [], bookingIntent: displayed)
        try check("callable-document-parity") {
            BookingIntentSnapshot.fromTripData(terms.merging(context, uniquingKeysWith: { _, new in new })) == displayed
        }
        try check("round-trip-and-null-arrival") {
            let encoded = try displayed.callablePayload()
            return BookingIntentSnapshot.fromPayload(encoded) == displayed &&
                ((encoded["terms"] as? [String: Any])?["arrivalBy"] is NSNull)
        }
        try check("selected-seats-and-child") {
            let request = try bookingRequestPayload(trip: trip, childId: "child", seats: 2)
            return request["tripId"] as? String == "trip" && request["seats"] as? Int == 2 &&
                request["childId"] as? String == "child" &&
                (request["expectedBookingIntent"] as? [String: Any]).flatMap(BookingIntentSnapshot.fromPayload) == displayed
        }
        try check("adult-does-not-invent-child") {
            try bookingRequestPayload(trip: trip, childId: nil, seats: 1)["childId"] == nil
        }
        try check("persisted-date-remains-bookable") {
            var document = terms.merging(context, uniquingKeysWith: { _, new in new })
            document["departureAt"] = Date(timeIntervalSince1970: 1_740_000_000.25)
            return BookingIntentSnapshot.fromTripData(document)?.isValid == true
        }
        for (key, value) in [("priceCents", -1 as Any), ("priceCents", 2.5 as Any), ("departureAt", "yesterday" as Any),
            ("origin", ["lat": 95, "lng": 4] as Any)] {
            try check("invalid-term-\(key)-\(cases.count)") {
                var bad = terms; bad[key] = value
                return BookingIntentSnapshot.fromPayload(["terms": bad, "context": context]) == nil
            }
        }
        for (key, value) in [("seatsTotal", 0 as Any), ("driverUserId", "../driver" as Any),
            ("returnTrip", "false" as Any), ("appliedChangeId", "old" as Any)] {
            try check("invalid-context-\(key)") {
                var bad = context; bad[key] = value
                return BookingIntentSnapshot.fromPayload(["terms": terms, "context": bad]) == nil
            }
        }
        try check("missing-snapshot-rejected") {
            let noQuote = TripSummary(id: "trip", title: "Trip", club: "Club", category: "U8", departureLabel: "10h00",
                seatsAvailable: 4, priceLabel: "2,50 EUR", reasons: [])
            do { _ = try bookingRequestPayload(trip: noQuote, childId: nil, seats: 1); return false }
            catch is BookingIntentError { return true }
        }
        try check("a-new-document-does-not-replace-displayed-terms") {
            var changed = terms; changed["priceCents"] = 900
            let request = try bookingRequestPayload(trip: trip, childId: nil, seats: 1)
            return displayed.terms.priceCents == 250 &&
                BookingIntentSnapshot.fromPayload(["terms": changed, "context": context])?.terms.priceCents == 900 &&
                (request["expectedBookingIntent"] as? [String: Any])
                    .flatMap(BookingIntentSnapshot.fromPayload)?.terms.priceCents == 250
        }
        let result: [String: Any] = ["testedAt": ISO8601DateFormatter().string(from: Date()),
            "scope": "foundation-wire-contract-not-ios-ui", "cases": cases, "passed": true]
        let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
        if CommandLine.arguments.count > 1 { try data.write(to: URL(fileURLWithPath: CommandLine.arguments[1]), options: .atomic) }
        print("Swift booking wire checks: \(cases.count) passed; not an iOS device or Firebase SDK test.")
    }
}
