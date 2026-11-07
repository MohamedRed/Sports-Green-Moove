import Foundation
import CoreFoundation

enum MembershipWire {
    static func require(_ value: Bool) throws { if !value { throw MembershipError.invalidResponse } }
    static func id(_ value: String) -> Bool {
        !value.isEmpty && value.utf8.count <= 1500 && !value.contains("/") && value != "." && value != ".." &&
        value.range(of: "^__.*__$", options: .regularExpression) == nil
    }
    static func requestableId(_ value: String) -> Bool { value.range(of: "^[A-Za-z0-9._-]{1,120}$", options: .regularExpression) != nil && id(value) }
    static func text(_ value: Any?, maximum: Int = 160) throws -> String? {
        if value == nil || value is NSNull { return nil }
        guard let text = value as? String, !text.isEmpty, text.utf16.count <= maximum,
              text == text.trimmingCharacters(in: .whitespacesAndNewlines),
              text.range(of: #"[\x{0000}-\x{001f}\x{007f}-\x{009f}\x{202a}-\x{202e}\x{2066}-\x{2069}]"#, options: .regularExpression) == nil else { throw MembershipError.invalidResponse }
        return text
    }
    static func requiredText(_ value: Any?, maximum: Int = 160) throws -> String {
        guard let value = try text(value, maximum: maximum) else { throw MembershipError.invalidResponse }; return value
    }
    static func identifier(_ value: Any?) throws -> String {
        guard let value = value as? String, id(value) else { throw MembershipError.invalidResponse }; return value
    }
    static func boolean(_ value: Any?) throws -> Bool {
        guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { throw MembershipError.invalidResponse }; return number.boolValue
    }
    static func cursor(_ value: Any?) throws -> String? {
        if value is NSNull { return nil }
        guard let value = value as? String, (1...16_384).contains(value.utf8.count),
              value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else { throw MembershipError.invalidResponse }; return value
    }
    static func version(_ value: Any?) throws -> String {
        guard let value = value as? String, value.utf8.count <= 32, value.range(of: "^-?[0-9]+\\.[0-9]{1,9}$", options: .regularExpression) != nil else {
            throw MembershipError.invalidResponse
        }; return value
    }
    static func member(_ data: [String: Any]?, documentId: String, uid: String, clubId: String) throws -> ClubMembership? {
        guard let data else { return nil }
        try require(id(uid) && id(clubId) && documentId == uid + "_" + clubId && data["userId"] as? String == uid && data["clubId"] as? String == clubId)
        return try .init(role: requiredText(data["role"], maximum: 80), status: text(data["status"], maximum: 80),
            active: data["active"] == nil ? nil : boolean(data["active"]))
    }
    static func club(_ documentId: String, data: [String: Any]) throws -> MembershipClub {
        try require(id(documentId))
        let count: Int64?
        if data["memberCount"] == nil || data["memberCount"] is NSNull { count = nil }
        else {
            guard let number = data["memberCount"] as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { throw MembershipError.invalidResponse }
            let value = number.doubleValue
            try require(value.isFinite && value >= 0 && value <= 9_007_199_254_740_991 && value.rounded() == value); count = Int64(value)
        }
        return try .init(id: documentId, name: text(data["name"]), sport: text(data["sport"]), count: count,
            status: text(data["status"], maximum: 80), membership: nil)
    }
    static func choices(_ value: Any?, uid: String) throws -> MembershipPage<MembershipChoice> {
        guard let data = value as? [String: Any], let rows = data["items"] as? [[String: Any]], rows.count <= 20 else { throw MembershipError.invalidResponse }
        let items = try rows.map { try MembershipChoice(id: identifier($0["id"]), name: requiredText($0["name"])) }
        try require(Set(items.map(\.id)).count == items.count)
        return try .init(userId: uid, items: items, cursor: cursor(data["nextCursor"]))
    }
    static func reviews(_ value: Any?, uid: String, clubId: String) throws -> MembershipPage<MembershipReview> {
        guard let data = value as? [String: Any], let rows = data["items"] as? [[String: Any]], rows.count <= 20 else { throw MembershipError.invalidResponse }
        let items = try rows.map { row -> MembershipReview in
            let user = try identifier(row["userId"]), itemId = try identifier(row["id"])
            try require(itemId == user + "_" + clubId)
            guard let raw = row["allowedActions"] as? [String] else { throw MembershipError.invalidResponse }
            let actions = raw.compactMap(MembershipDecision.init(rawValue:))
            try require(raw.isEmpty || actions == [.approve, .reject] && raw.count == 2)
            let result = try MembershipReview(id: itemId, userId: user, name: text(row["name"]), role: requiredText(row["role"], maximum: 80),
                status: requiredText(row["status"], maximum: 80), active: boolean(row["active"]), team: text(row["teamName"]),
                version: version(row["requestVersion"]), actions: actions)
            try require(actions.isEmpty || result.role == "member" && result.status == "requested" && !result.active)
            return result
        }
        try require(Set(items.map(\.id)).count == items.count)
        return try .init(userId: uid, items: items, cursor: cursor(data["nextCursor"]))
    }
    static func receipt(_ value: Any?, uid: String, clubId: String) throws -> MembershipReceipt {
        guard let data = value as? [String: Any] else { throw MembershipError.invalidResponse }
        let item = try identifier(data["membershipId"]), status = try requiredText(data["status"], maximum: 80)
        try require(item == uid + "_" + clubId && data["clubId"] as? String == clubId)
        return try .init(id: item, status: status, reused: boolean(data["reused"]))
    }
    static func decision(_ value: Any?, row: MembershipReview, decision: MembershipDecision) throws -> MembershipDecisionReceipt {
        guard let data = value as? [String: Any] else { throw MembershipError.invalidResponse }
        let item = try identifier(data["membershipId"]), status = try requiredText(data["status"], maximum: 80)
        try require(item == row.id && status == (decision == .approve ? "active" : "rejected"))
        return try .init(id: item, status: status, reviewId: identifier(data["reviewId"]))
    }
}
