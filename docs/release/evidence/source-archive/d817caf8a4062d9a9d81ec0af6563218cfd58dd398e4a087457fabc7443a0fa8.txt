import Foundation

enum TeamChatRequest: Sendable {
    case choices(clubId: String?, cursor: String?)
    case messages(TeamChatTarget, cursor: String?)
    case send(TeamChatTarget, body: String, requestId: UUID)
    case read(TeamChatTarget, accessVersion: String, ids: [String])
    var name: String {
        switch self {
        case .choices: return "listTeamChatOptions"
        case .messages: return "getTeamChatMessages"
        case .send: return "sendTeamChatMessage"
        case .read: return "markTeamChatMessagesRead"
        }
    }
    func payload() throws -> [String: Any] {
        switch self {
        case let .choices(clubId, cursor):
            var value: [String: Any] = ["kind": clubId == nil ? "clubs" : "teams"]
            if let clubId { try TeamChatWire.require(TeamChatWire.validId(clubId)); value["clubId"] = clubId }
            if let cursor { value["cursor"] = try TeamChatWire.cursor(cursor) }
            return value
        case let .messages(target, cursor):
            var value: [String: Any] = try TeamChatWire.target(target)
            if let cursor { value["cursor"] = try TeamChatWire.cursor(cursor) }
            return value
        case let .send(target, body, requestId):
            try TeamChatWire.require(TeamChatWire.validBody(body) && body == TeamChatText.normalized(body))
            var value: [String: Any] = try TeamChatWire.target(target)
            value["body"] = body; value["clientMessageId"] = requestId.uuidString.lowercased(); return value
        case let .read(target, accessVersion, ids):
            try TeamChatWire.require((1...50).contains(ids.count) && Set(ids).count == ids.count)
            for id in ids { _ = try TeamChatWire.hash(id) }
            var value: [String: Any] = try TeamChatWire.target(target)
            value["expectedAccessVersion"] = try TeamChatWire.hash(accessVersion); value["messageIds"] = ids; return value
        }
    }
}
