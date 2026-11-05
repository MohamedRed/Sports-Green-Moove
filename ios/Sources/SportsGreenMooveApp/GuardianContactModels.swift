import Foundation

enum GuardianContactStatus: String, Sendable { case requested, verified, refused, withdrawn, revoked }

struct GuardianContactRecord: Identifiable, Equatable, Sendable {
    let id: String
    let parentUserId: String
    let childId: String
    let clubId: String
    let childName: String?
    let clubName: String?
    let status: GuardianContactStatus
    let revision: Int64
    let allowedActions: [String]
    var selectable: Bool { status == .verified && childName != nil && clubName != nil }
    var target: EmergencyContactTarget { .child(childId: childId, clubId: clubId) }
}

struct GuardianContactPage: Equatable, Sendable {
    let items: [GuardianContactRecord]
    let nextCursor: String?
}

enum GuardianContactWire {
    static func validCursor(_ value: String?) -> Bool {
        guard let value else { return true }
        return (1...16_384).contains(value.utf8.count) && value.utf8.allSatisfy {
            (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0) || $0 == 45 || $0 == 95
        }
    }
    static func validate(_ row: GuardianContactRecord, uid: String) throws {
        try EmergencyContactWire.require(row.parentUserId == uid && EmergencyContactWire.validId(uid) &&
            EmergencyContactWire.validId(row.childId) && EmergencyContactWire.validId(row.clubId))
        _ = try EmergencyContactWire.instance(row.id)
        try EmergencyContactWire.require(row.revision > 0 && row.revision <= EmergencyContactWire.maximumRevision)
        for name in [row.childName, row.clubName].compactMap({ $0 }) {
            try EmergencyContactWire.require(EmergencyContactWire.validText(name, maximum: 120))
        }
        let action = row.status == .requested || row.status == .verified ? "withdraw" : "request"
        try EmergencyContactWire.require(Set(row.allowedActions).count == row.allowedActions.count && row.allowedActions.allSatisfy { $0 == action })
    }
    static func validate(_ page: GuardianContactPage, uid: String) throws {
        try EmergencyContactWire.require(page.items.count <= 20 && validCursor(page.nextCursor) &&
            (page.nextCursor == nil || !page.items.isEmpty) && Set(page.items.map(\.id)).count == page.items.count)
        for row in page.items { try validate(row, uid: uid) }
        try EmergencyContactWire.require(Set(page.items.map(\.target)).count == page.items.count)
    }
    static func page(_ raw: Any?, uid: String) throws -> GuardianContactPage {
        guard let raw = raw as? [String: Any], let items = raw["items"] as? [[String: Any]], raw.keys.contains("nextCursor") else {
            throw EmergencyContactError.invalidResponse
        }
        let cursor: String?
        if raw["nextCursor"] is NSNull { cursor = nil }
        else if let token = raw["nextCursor"] as? String { cursor = token }
        else { throw EmergencyContactError.invalidResponse }
        let rows = try items.map { item -> GuardianContactRecord in
            guard let id = item["id"] as? String, let parent = item["parentUserId"] as? String,
                  let child = item["childId"] as? String, let club = item["clubId"] as? String,
                  let state = item["status"] as? String, let status = GuardianContactStatus(rawValue: state),
                  let actions = item["allowedActions"] as? [String] else { throw EmergencyContactError.invalidResponse }
            return GuardianContactRecord(id: id, parentUserId: parent, childId: child, clubId: club,
                childName: try optionalName(item, "childName"), clubName: try optionalName(item, "clubName"),
                status: status, revision: try EmergencyContactWire.revision(item["revision"]), allowedActions: actions)
        }
        let result = GuardianContactPage(items: rows, nextCursor: cursor); try validate(result, uid: uid)
        return result
    }
    private static func optionalName(_ row: [String: Any], _ key: String) throws -> String? {
        guard row.keys.contains(key) else { throw EmergencyContactError.invalidResponse }
        if row[key] is NSNull { return nil }
        guard let value = row[key] as? String, EmergencyContactWire.validText(value, maximum: 120) else {
            throw EmergencyContactError.invalidResponse
        }
        return value
    }
}
