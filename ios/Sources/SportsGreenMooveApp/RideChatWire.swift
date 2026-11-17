import Foundation
import CoreFoundation

enum RideChatWire {
    static func require(_ value: Bool) throws { if !value { throw RideChatError.invalidResponse } }
    static func object(_ value: Any?) throws -> [String: Any] {
        guard let value = value as? [String: Any] else { throw RideChatError.invalidResponse }; return value
    }
    static func text(_ value: Any?, maximum: Int = 32_768) throws -> String {
        guard let value = value as? String, !value.isEmpty, value.utf16.count <= maximum,
              RideChatText.same(value, RideChatText.normalized(value)) else { throw RideChatError.invalidResponse }; return value
    }
    static func nullableText(_ data: [String: Any], _ key: String) throws -> String? {
        try require(data.keys.contains(key)); if data[key] is NSNull { return nil }; return try text(data[key])
    }
    static func id(_ value: Any?) throws -> RideChatID {
        guard let value = value as? String else { throw RideChatError.invalidResponse }; return try RideChatID(value)
    }
    static func hash(_ value: Any?) throws -> RideChatID {
        let id = try id(value); try require(id.value.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil); return id
    }
    static func ids(_ value: Any?, maximum: Int = 100) throws -> [RideChatID] {
        guard let values = value as? [Any], values.count <= maximum else { throw RideChatError.invalidResponse }
        let result = try values.map(id); try require(Set(result).count == result.count); return result
    }
    static func integer(_ value: Any?, minimum: Int64 = 0, maximum: Int64 = 9_007_199_254_740_991) throws -> Int64 {
        guard let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID() else { throw RideChatError.invalidResponse }
        let number = value.doubleValue
        try require(number.isFinite && number.rounded() == number && number >= Double(minimum) && number <= Double(maximum))
        return value.int64Value
    }
    static func boolean(_ value: Any?) throws -> Bool {
        guard let value = value as? NSNumber, CFGetTypeID(value) == CFBooleanGetTypeID() else { throw RideChatError.invalidResponse }; return value.boolValue
    }
    static func reference(_ value: [String: Any]) throws -> RideChatReference {
        guard let raw = value["sourceType"] as? String, let kind = RideChatReference.Kind(rawValue: raw) else { throw RideChatError.invalidResponse }
        return try .init(kind: kind, sourceId: id(value["sourceId"]))
    }
    static func cursor(_ value: Any?) throws -> String {
        let value = try text(value, maximum: 2_048)
        try require(value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil); return value
    }
    static func nextCursor(_ data: [String: Any]) throws -> String? {
        try require(data.keys.contains("nextCursor")); if data["nextCursor"] is NSNull { return nil }; return try cursor(data["nextCursor"])
    }
    static func position(_ data: [String: Any], seconds: String, nanos: String, id: RideChatID) throws -> RideChatPosition {
        try .init(seconds: integer(data[seconds], minimum: -62_135_596_800, maximum: 253_402_300_799),
            nanos: Int32(integer(data[nanos], maximum: 999_999_999)), id: id)
    }
    static func access(_ raw: Any?, uid: RideChatID, reference expected: RideChatReference) throws -> RideChatAccess {
        let value = try object(object(raw)["conversation"])
        try require(id(value["currentUserId"]) == uid && reference(value) == expected)
        guard let rows = value["participants"] as? [[String: Any]], (1...100).contains(rows.count) else { throw RideChatError.invalidResponse }
        var names: [RideChatID: String?] = [:]
        var seen = Set<RideChatID>()
        for row in rows {
            let key = try id(row["userId"]); try require(seen.insert(key).inserted)
            names[key] = .some(try nullableText(row, "displayName"))
        }
        try require(seen.contains(uid))
        return try .init(uid: uid, reference: expected, title: text(value["title"]), participants: names)
    }
}
