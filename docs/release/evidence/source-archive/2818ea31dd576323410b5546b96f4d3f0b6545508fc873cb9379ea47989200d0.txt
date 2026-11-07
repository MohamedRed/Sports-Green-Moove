import Foundation
import FirebaseAuth
import FirebaseFunctions

struct FirebaseBackendGateway: Sendable {}
let gateway = FirebaseBackendGateway(), sdk = TestFunctions.shared
let bytes = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let initial = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
let original = initial["matches"] as! [[String: Any]]
let criteria = TripSearchCriteria(requesterUserId: "isolated-parent",
    origin: .init(placeId: "isolated-origin", label: "Origine fictive", formattedAddress: "Origine fictive", lat: 50.5, lng: 4.5),
    destination: .init(placeId: "isolated-end", label: "Destination fictive", formattedAddress: "Destination fictive", lat: 50.6, lng: 4.6),
    desiredDepartureAtIso: "2026-11-30T14:45:00.000Z", seatsNeeded: 2, baggage: "medium", returnTrip: false,
    requireChildTracking: true, guardianConsent: true, childUserId: "isolated-child-2",
    clubId: "sgm-qa-club-green-wavre", teamId: "sgm-qa-club-green-wavre-u8", category: "U 7/8")

func canonicalRequest(_ input: [String: Any]) throws -> Data {
    try JSONSerialization.data(withJSONObject: input, options: .sortedKeys)
}
let canonical = try canonicalRequest(["seatsNeeded": 2, "guardianConsent": true])
let reordered = try canonicalRequest(["guardianConsent": true, "seatsNeeded": 2])
precondition(canonical == reordered)
for changed: [String: Any] in [["seatsNeeded": 1, "guardianConsent": true], ["seatsNeeded": 2, "guardianConsent": 1],
    ["seatsNeeded": 2], ["seatsNeeded": 2, "guardianConsent": true, "extra": "rejected"]] {
    let changedBytes = try canonicalRequest(changed); precondition(canonical != changedBytes)
}
print("Callable request bytes passed: key order normalized; changed values, boolean/number substitution and missing/extra fields rejected")

@MainActor func read(_ envelope: [String: Any], revocation: String? = nil) async throws -> [TripMatchSummary] {
    Auth.auth().setUser(criteria.requesterUserId)
    let task = Task { @MainActor in try await gateway.searchTripMatches(criteria: criteria) }
    let deadline = ContinuousClock.now.advanced(by: .seconds(10))
    while sdk.pending == 0 { precondition(ContinuousClock.now < deadline); await Task.yield() }
    let request = sdk.last!
    precondition(request.0 == "searchTrips")
    let expected: [String: Any] = ["desiredDepartureAt": criteria.desiredDepartureAtIso,
        "origin": ["lat": 50.5, "lng": 4.5], "destination": ["lat": 50.6, "lng": 4.6],
        "seatsNeeded": 2, "baggage": "medium", "returnTrip": false, "requireChildTracking": true,
        "guardianConsent": true, "childUserId": "isolated-child-2", "clubId": "sgm-qa-club-green-wavre",
        "teamId": "sgm-qa-club-green-wavre-u8", "category": "U 7/8"]
    let expectedBytes = try canonicalRequest(expected)
    precondition(request.1 == expectedBytes, "Search request differs from the exact expected JSON wire payload")
    if revocation == "signout" { Auth.auth().setUser(nil) }
    if revocation == "other-user" { Auth.auth().setUser("other") }
    if revocation == "cancel" { task.cancel() }
    sdk.release(try JSONSerialization.data(withJSONObject: envelope),
        error: revocation == "error" ? NSError(domain: "isolated-transport", code: 1) : nil)
    return try await task.value
}

let result = try await read(initial)
precondition(result.count == original.count)
for (index, match) in result.enumerated() {
    let summary = original[index]["summary"] as! [String: Any]
    precondition(match.tripId == summary["id"] as? String && match.summary.id == match.tripId)
    precondition(match.summary.priceLabel == summary["priceLabel"] as? String)
    precondition(match.summary.seatsAvailable == summary["seatsAvailable"] as? Int)
    precondition(match.summary.dateLabel == summary["dateLabel"] as? String)
    precondition(match.summary.timeLabel == summary["timeLabel"] as? String)
    precondition(match.summary.mapPreview?.start == match.summary.bookingIntent?.terms.origin)
    precondition(match.summary.mapPreview?.end == match.summary.bookingIntent?.terms.destination)
    if index == 2 { precondition(match.summary.mapPreview?.encodedPolyline == "_p~iF~ps|U_ulLnnqC_mqNvxq`@") }
    let request = try bookingRequestPayload(trip: match.summary, childId: criteria.childUserId, seats: criteria.seatsNeeded)
    precondition(request["tripId"] as? String == match.tripId && request["childId"] as? String == "isolated-child-2")
    precondition(request["seats"] as? Int == 2)
    let submitted = request["expectedBookingIntent"] as! [String: Any]
    precondition(BookingIntentSnapshot.fromPayload(submitted) == match.summary.bookingIntent)
    precondition(BookingIntentSnapshot.fromPayload(summary["bookingIntent"] as! [String: Any]) == match.summary.bookingIntent)
}
print("Search contract passed: three actual server summaries retain exact labels, route endpoints and booking snapshot for the second child and two seats; no service or phone")

let mutations: [(String, (inout [String: Any]) -> Void)] = [
    ("missing-price", { $0["priceLabel"] = nil }), ("missing-title", { $0["title"] = nil }),
    ("boolean-capacity", { $0["seatsAvailable"] = true }), ("fractional-capacity", { $0["seatsAvailable"] = 2.5 }),
    ("over-capacity", { $0["seatsAvailable"] = 9 }), ("missing-booking-terms", { $0["bookingIntent"] = nil }),
    ("unknown-status", { $0["status"] = "invented" }), ("nonstring-reasons", { $0["reasons"] = [1] }),
]
var accepted: [String] = []
for (name, mutate) in mutations {
    var row = original[1], summary = row["summary"] as! [String: Any]
    mutate(&summary); row["summary"] = summary
    do { _ = try await read(["matches": [row]]); accepted.append(name) } catch {}
}
if CommandLine.arguments[2] == "baseline" {
    print("Search contract negative baseline: \(accepted.count)/\(mutations.count) malformed results accepted: \(accepted.joined(separator: ", ")); not accepted")
} else {
    precondition(accepted.isEmpty, "Malformed search results accepted: \(accepted)")
    let invalid = searchContractMutations(original[1])
    for (name, envelope) in invalid {
        do { _ = try await read(envelope); preconditionFailure("Malformed contract accepted: \(name)") } catch {}
    }
    let empty = try await read(["matches": []]); precondition(empty.isEmpty)
    for kind in ["signout", "other-user", "cancel", "error"] {
        do { _ = try await read(initial, revocation: kind); preconditionFailure("Unowned result restored: \(kind)") } catch {}
        precondition(sdk.pending == 0)
    }
    Auth.auth().setUser("other")
    let before = sdk.count
    do { _ = try await gateway.searchTripMatches(criteria: criteria); preconditionFailure("Unowned search dispatched") } catch {}
    precondition(sdk.count == before)
    for value in [Double.infinity, -.infinity, .nan] {
        var row = original[1]; row["score"] = value
        do { _ = try TripSearchWire.matches(["matches": [row]], seatsNeeded: 2); preconditionFailure("Nonfinite score accepted") } catch {}
    }
    print("Search contract rejection passed: \(mutations.count + invalid.count) incomplete, contradictory or unsafe response groups; no guessed price, dropped row or malformed route accepted")
    print("Search contract ownership passed: exact criteria payload, four delayed SDK error/identity/cancellation cases and one pre-call denial; three direct nonfinite score denials")
}
