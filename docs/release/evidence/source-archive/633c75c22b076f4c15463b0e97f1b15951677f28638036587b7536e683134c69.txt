import Foundation
import CoreFoundation

enum TeamChatWire {
    static let maximum: Int64 = 9_007_199_254_740_991
    static func require(_ value: Bool) throws { if !value { throw TeamChatError.invalidResponse } }
    static func validId(_ value: String) -> Bool {
        (1...256).contains(value.utf16.count) && !value.contains("/") && value != "." && value != ".." &&
        value.range(of: "^__.*__$", options: .regularExpression) == nil
    }
    static func labelIsValid(_ value: String, maximum: Int = 160) -> Bool {
        !value.isEmpty && value == value.trimmingCharacters(in: .whitespacesAndNewlines) && value.utf16.count <= maximum &&
        value.range(of: #"[\x{0000}-\x{001f}\x{007f}-\x{009f}\x{202a}-\x{202e}\x{2066}-\x{2069}]"#, options: .regularExpression) == nil
    }
    static func hash(_ value: Any?) throws -> String {
        guard let value = value as? String, value.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else {
            throw TeamChatError.invalidResponse
        }; return value
    }
    static func cursor(_ value: Any?) throws -> String? {
        if value is NSNull { return nil }
        guard let value = value as? String, (1...16_384).contains(value.utf8.count),
              value.utf8.allSatisfy({ (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0) || $0 == 45 || $0 == 95 }) else {
            throw TeamChatError.invalidResponse
        }; return value
    }
    static func integer(_ value: Any?, minimum: Int64 = 0, maximum: Int64 = maximum) throws -> Int64 {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { throw TeamChatError.invalidResponse }
        let d = number.doubleValue
        try require(d.isFinite && d.rounded() == d && d >= Double(minimum) && d <= Double(maximum)); return Int64(d)
    }
    static func boolean(_ value: Any?) throws -> Bool {
        guard let n = value as? NSNumber, CFGetTypeID(n) == CFBooleanGetTypeID() else { throw TeamChatError.invalidResponse }
        return n.boolValue
    }
    static func label(_ value: Any?) throws -> String? {
        if value is NSNull { return nil }
        guard let value = value as? String, labelIsValid(value) else { throw TeamChatError.invalidResponse }; return value
    }
    static func target(_ value: TeamChatTarget) throws -> [String: String] {
        try require(validId(value.teamId)); return ["teamId": value.teamId, "expectedTeamInstanceId": try hash(value.instanceId)]
    }
    static func validTarget(_ value: TeamChatTarget) -> Bool { validId(value.teamId) && (try? hash(value.instanceId)) != nil }
    static func choices(_ value: Any?, uid: String, clubId: String?) throws -> TeamChatChoices {
        guard let data = value as? [String: Any], let rows = data["items"] as? [[String: Any]], rows.count <= 5,
              data["currentUserId"] as? String == uid, data["kind"] as? String == (clubId == nil ? "clubs" : "teams") else {
            throw TeamChatError.invalidResponse
        }
        if let clubId { try require(data["clubId"] as? String == clubId) } else { try require(data["clubId"] is NSNull) }
        let items = try rows.map { row -> TeamChatChoice in
            guard let id = row["id"] as? String, validId(id) else { throw TeamChatError.invalidResponse }
            if clubId == nil { try require(row["teamInstanceId"] is NSNull && row["unreadCount"] is NSNull) }
            return try .init(id: id, name: label(row["name"]), instanceId: clubId == nil ? nil : hash(row["teamInstanceId"]),
                unreadCount: clubId == nil ? nil : integer(row["unreadCount"]))
        }
        try require(Set(items.map(\.id)).count == items.count)
        return try .init(items: items, nextCursor: cursor(data["nextCursor"]))
    }
    static func page(_ value: Any?, uid: String, target: TeamChatTarget) throws -> TeamChatPage {
        guard let data = value as? [String: Any], data["currentUserId"] as? String == uid,
              data["teamId"] as? String == target.teamId, data["teamInstanceId"] as? String == target.instanceId,
              data["historyPolicy"] as? String == "after-current-admission", let rows = data["items"] as? [[String: Any]], rows.count <= 50 else {
            throw TeamChatError.invalidResponse
        }
        let items = try rows.map { row -> TeamChatMessage in
            guard let sender = row["senderUserId"] as? String, validId(sender), let body = row["body"] as? String,
                  validBody(body), let id = row["requestId"] as? String, let request = UUID(uuidString: id), id == request.uuidString.lowercased() else {
                throw TeamChatError.invalidResponse
            }
            let read = try boolean(row["needsRead"]); try require(sender != uid || !read)
            return try .init(id: hash(row["id"]), senderId: sender, author: label(row["authorName"]), body: body,
                requestId: request, sequence: integer(row["sequence"], minimum: 1),
                seconds: integer(row["createdAtSeconds"], minimum: -62_135_596_800, maximum: 253_402_300_799),
                nanos: integer(row["createdAtNanos"], maximum: 999_999_999), needsRead: read)
        }
        try validateMessages(items)
        return try .init(title: label(data["title"]), accessVersion: hash(data["accessVersion"]), items: items, nextCursor: cursor(data["nextCursor"]))
    }
    static func validBody(_ body: String) -> Bool {
        !TeamChatText.normalized(body).isEmpty && body.utf16.count <= 1000
    }
    static func validateMessages(_ items: [TeamChatMessage]) throws {
        try require(items.count <= 50)
        for row in items {
            _ = try hash(row.id)
            try require(validId(row.senderId) && validBody(row.body) && row.body == TeamChatText.normalized(row.body) &&
                row.sequence > 0 && row.sequence <= maximum && (-62_135_596_800...253_402_300_799).contains(row.seconds) &&
                (0...999_999_999).contains(row.nanos) && (row.author == nil || labelIsValid(row.author!)))
            try require(try row.id == TeamChatIdentity.operation(uid: row.senderId, requestId: row.requestId))
        }
        try require(Set(items.map(\.id)).count == items.count && Set(items.map(\.sequence)).count == items.count)
        try require(items == items.sorted(by: TeamChatMessage.newer))
    }
    static func validateChoices(_ page: TeamChatChoices, clubId: String?) throws {
        try require(page.items.count <= 5 && Set(page.items.map(\.id)).count == page.items.count)
        if let next = page.nextCursor { _ = try cursor(next) }
        for row in page.items {
            try require(validId(row.id) && (row.name == nil || labelIsValid(row.name!)))
            if clubId == nil { try require(row.instanceId == nil && row.unreadCount == nil) }
            else { _ = try hash(row.instanceId); try require(row.unreadCount != nil && (0...maximum).contains(row.unreadCount!)) }
        }
    }
    static func receipt(_ value: Any?, uid: String, target: TeamChatTarget, requestId: UUID) throws -> String {
        guard let data = value as? [String: Any] else { throw TeamChatError.invalidResponse }
        try require(data["currentUserId"] as? String == uid && data["teamInstanceId"] as? String == target.instanceId)
        _ = try boolean(data["reused"]); _ = try integer(data["sequence"], minimum: 1)
        let id = try hash(data["messageId"]); try require(try id == TeamChatIdentity.operation(uid: uid, requestId: requestId)); return id
    }
    static func reads(_ value: Any?, uid: String, target: TeamChatTarget, version: String, ids: [String]) throws {
        guard let data = value as? [String: Any], let read = data["readMessageIds"] as? [String] else { throw TeamChatError.invalidResponse }
        try require(data["currentUserId"] as? String == uid && data["teamInstanceId"] as? String == target.instanceId &&
            data["accessVersion"] as? String == version && read == ids)
    }
}
