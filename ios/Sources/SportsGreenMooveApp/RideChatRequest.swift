import Foundation

enum RideChatRequest: Sendable {
    case directory(cursor: String?)
    case bookings(cursor: String?)
    case access(RideChatReference)
    case send(RideChatReference, body: String, requestId: UUID)
    case read(RideChatReference, ids: [RideChatID])
    var name: String {
        switch self {
        case .directory: "listChatConversations"; case .bookings: "listChatBookingOptions"
        case .access: "getChatConversation"; case .send: "sendChatMessage"; case .read: "markChatMessagesRead"
        }
    }
    func payload() throws -> [String: Any] {
        switch self {
        case let .directory(cursor), let .bookings(cursor):
            if let cursor { return ["cursor": try RideChatWire.cursor(cursor)] }; return [:]
        case let .access(reference): return reference.payload
        case let .send(reference, body, requestId):
            try RideChatWire.require(RideChatText.valid(body) && RideChatText.same(body, RideChatText.normalized(body)))
            return [reference.sendKey: reference.sourceId.value, "body": body, "clientMessageId": requestId.uuidString.lowercased()]
        case let .read(reference, ids):
            try RideChatWire.require((1...50).contains(ids.count) && Set(ids).count == ids.count)
            return reference.payload.merging(["messageIds": ids.map(\.value)]) { _, new in new }
        }
    }
}
