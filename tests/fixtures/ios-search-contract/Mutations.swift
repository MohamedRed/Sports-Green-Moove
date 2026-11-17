import Foundation

func searchContractMutations(_ original: [String: Any]) -> [(String, [String: Any])] {
    var results: [(String, [String: Any])] = []
    func row(_ name: String, _ change: (inout [String: Any]) -> Void) {
        var value = original; change(&value); results.append((name, ["matches": [value]]))
    }
    func summary(_ name: String, _ change: (inout [String: Any]) -> Void) {
        row(name) { value in var data = value["summary"] as! [String: Any]; change(&data); value["summary"] = data }
    }
    func route(_ name: String, _ change: (inout [String: Any]) -> Void) {
        row(name) { value in var data = value["route"] as! [String: Any]; change(&data); value["route"] = data }
    }
    for field in ["id", "club", "category", "sport", "departureLabel", "dateLabel", "timeLabel", "distanceLabel", "seatsLabel", "passengerInitials", "mapPreview"] {
        summary("missing-" + field) { $0[field] = nil }
    }
    summary("different-id") { $0["id"] = "isolated-other-trip" }
    summary("wrong-price") { $0["priceLabel"] = "Gratuit" }
    summary("wrong-seats-label") { $0["seatsLabel"] = "8 places" }
    summary("negative-capacity") { $0["seatsAvailable"] = -1 }
    summary("zero-capacity") { $0["seatsAvailable"] = 0 }
    summary("below-requested-capacity") { $0["seatsAvailable"] = 1 }
    summary("less-total-than-requested") { value in
        var intent = value["bookingIntent"] as! [String: Any], context = intent["context"] as! [String: Any]
        context["seatsTotal"] = 1; intent["context"] = context; value["bookingIntent"] = intent
    }
    summary("blank-title") { $0["title"] = " \n\t" }
    summary("oversize-title") { $0["title"] = String(repeating: "x", count: 1_001) }
    summary("malformed-intent") { $0["bookingIntent"] = [:] }
    summary("boolean-point") { $0["mapPreview"] = ["start": ["lat": true, "lng": 4.5], "end": ["lat": 50.5, "lng": 4.6]] }
    summary("foreign-endpoints") { $0["mapPreview"] = ["start": ["lat": 1, "lng": 2], "end": ["lat": 3, "lng": 4]] }
    for value: Any in [NSNull(), true, 0, -1, "88"] { row("invalid-score-\(value)") { $0["score"] = value } }
    row("missing-summary") { $0["summary"] = nil }
    row("invalid-identity") { $0["tripId"] = "../other" }
    row("invalid-match-reasons") { $0["reasons"] = [true] }
    row("missing-route") { $0["route"] = nil }
    route("boolean-detour") { $0["detourDurationSeconds"] = true }
    route("fractional-detour") { $0["detourDurationSeconds"] = 2.5 }
    route("negative-detour") { $0["detourDurationSeconds"] = -1 }
    route("unsafe-large-detour") { $0["detourDurationSeconds"] = 1e100 }
    route("fractional-pickup") { $0["pickupDistanceMeters"] = 2.5 }
    route("negative-pickup") { $0["pickupDistanceMeters"] = -1 }
    route("foreign-polyline") { $0["finalEncodedPolyline"] = "_p~iF~ps|U_ulLnnqC_mqNvxq`@" }
    for encoded in ["", "?", "???", "~", "!!!!!!!!", "~~~~~~~?", String(repeating: "?", count: 200_002), "éé"] {
        summary("invalid-polyline-\(encoded.utf8.count)") { value in
            var preview = value["mapPreview"] as! [String: Any]; preview["encodedPolyline"] = encoded; value["mapPreview"] = preview
        }
    }
    results.append(("duplicate-trip", ["matches": [original, original]]))
    results.append(("too-many-matches", ["matches": Array(repeating: original, count: 13)]))
    results.append(("malformed-row", ["matches": [original, ["tripId": "bad-row"]]]))
    results.append(("missing-envelope", [:])); results.append(("wrong-envelope", ["matches": "invalid"]))
    return results
}
