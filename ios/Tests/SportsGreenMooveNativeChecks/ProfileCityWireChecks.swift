import Foundation

func checkProfileCityWire() throws {
    let raw: [String: Any] = ["userId": "parent", "city": "Liège", "revision": 1]
    let current = try ProfileCityWire.parse(raw, uid: "parent")
    check(current.city == "Liège" && current.revision == 1, "Owned profile city was not parsed")
    let empty = try ProfileCityWire.parse(["userId": "parent", "city": NSNull(), "revision": 0], uid: "parent")
    check(empty.city == nil && empty.revision == 0, "Absent city fabricated a label")
    let removed = try ProfileCityWire.parse(["userId": "parent", "city": NSNull(), "revision": 3], uid: "parent")
    check(removed.city == nil && removed.revision == 3, "Removal lost the revision")
    check(ProfileCityWire.normalized(" Lie\u{0300}ge ") == "Liège", "City input is not normalized like the server")
    check(ProfileCityWire.normalized(String(repeating: "😀", count: 50)) != nil, "UTF16 input boundary rejected a valid value")
    var invalid: [[String: Any]] = []
    for patch in [["userId": "other"], ["userId": NSNull()], ["city": true], ["city": ""], ["city": " Liège"],
        ["city": "Lie\u{0300}ge"], ["city": String(repeating: "a", count: 101)], ["revision": true], ["revision": -1],
        ["revision": 0], ["revision": 0.5], ["revision": Double.nan], ["revision": Double.infinity],
        ["revision": 9_007_199_254_740_992 as Int64], ["revision": "1"], ["private": "extra"]] as [[String: Any]] {
        invalid.append(raw.merging(patch) { _, next in next })
    }
    for key in ["userId", "city", "revision"] { var value = raw; value.removeValue(forKey: key); invalid.append(value) }
    for value in invalid {
        do { _ = try ProfileCityWire.parse(value, uid: "parent"); fatalError("Malformed/foreign/noncanonical city was accepted") } catch { }
    }
    let forbidden = ["", " ", "\tWavre", "a\nb", "a\u{202e}b", "a\u{200b}b", "a\u{feff}b", String(repeating: "a", count: 101), String(repeating: "😀", count: 51)]
    for value in forbidden { check(ProfileCityWire.normalized(value) == nil, "Unsafe city input was normalized into a valid write") }
    for value: Any? in [nil, [], "invalid"] {
        do { _ = try ProfileCityWire.parse(value, uid: "parent"); fatalError("Malformed city envelope was accepted") } catch { }
    }
    let change = ProfileCityChange(city: "Liège", expectedRevision: 4, requestId: UUID())
    let payload = try ProfileCityRequest.save(change).payload()
    check(payload.count == 3 && payload["city"] as? String == "Liège" && payload["expectedRevision"] as? Int64 == 4 &&
        payload["requestId"] as? String == change.requestId.uuidString.lowercased(), "City request identity or version changed")
    let clear = try ProfileCityRequest.save(.init(city: nil, expectedRevision: 5, requestId: UUID())).payload()
    let read = try ProfileCityRequest.read.payload()
    check(clear["city"] is NSNull && read.isEmpty, "City removal omitted null or read selected another account")
    for change in [ProfileCityChange(city: " Liège", expectedRevision: 0, requestId: UUID()),
        .init(city: "Lie\u{0300}ge", expectedRevision: 0, requestId: UUID()), .init(city: nil, expectedRevision: -1, requestId: UUID()),
        .init(city: nil, expectedRevision: ProfileCityWire.maximumRevision, requestId: UUID())] {
        do { _ = try ProfileCityRequest.save(change).payload(); fatalError("Invalid city write was dispatched") } catch { }
    }
    print("ProfileCityWireChecks passed: 3 persisted states, \(invalid.count) malformed/foreign/noncanonical records, 9 unsafe inputs, 3 malformed envelopes and 4 invalid writes; exact null, UUID and revision payloads")
}
