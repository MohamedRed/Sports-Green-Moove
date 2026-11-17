import Foundation

func checkPlaceSearchWire() throws {
    let suggestion: [String: Any] = ["placeId": "isolated-origin", "label": "Adresse fictive", "mainText": "Adresse fictive"]
    let suggestions = try PlaceSearchWire.suggestions(["suggestions": [suggestion]])
    check(suggestions.count == 1 && suggestions[0].secondaryText == nil, "Absent optional place label was not represented as absent")
    let resolved: [String: Any] = ["placeId": "isolated-origin", "label": "Adresse fictive", "formattedAddress": "Rue fictive 1, Belgique", "location": ["lat": 50.5, "lng": 4.5]]
    let value = try PlaceSearchWire.resolved(["place": resolved]); check(value.lat == 50.5 && value.lng == 4.5, "Exact coordinates changed")
    for input in ["", "ab", String(repeating: "a", count: 121)] { rideChatReject("place query") { _ = try PlaceSearchWire.query(input) } }
    for input in ["", " spaced ", String(repeating: "a", count: 257)] { rideChatReject("place ID") { _ = try PlaceSearchWire.placeId(input) } }
    for field in ["placeId", "label"] {
        var invalid = suggestion; invalid.removeValue(forKey: field)
        rideChatReject("missing suggestion \(field)") { _ = try PlaceSearchWire.suggestions(["suggestions": [invalid]]) }
    }
    rideChatReject("duplicate suggestions") { _ = try PlaceSearchWire.suggestions(["suggestions": [suggestion, suggestion]]) }
    for field in ["placeId", "label", "formattedAddress", "location"] {
        var invalid = resolved; invalid.removeValue(forKey: field)
        rideChatReject("missing place \(field)") { _ = try PlaceSearchWire.resolved(["place": invalid]) }
    }
    for coordinate: Any in [true, "50.5", Double.infinity, Double.nan, 91.0, -91.0, NSNull()] {
        var invalid = resolved; invalid["location"] = ["lat": coordinate, "lng": 4.5]
        rideChatReject("invalid coordinate") { _ = try PlaceSearchWire.resolved(["place": invalid]) }
    }
    var invalid = resolved; invalid["location"] = ["lat": 50.5, "lng": 181.0]
    rideChatReject("longitude range") { _ = try PlaceSearchWire.resolved(["place": invalid]) }
    print("PlaceSearchWireChecks passed: 21 malformed input/response groups; exact coordinates, boolean/nonfinite denial, required labels, duplicate rejection and no guessed address")
}
