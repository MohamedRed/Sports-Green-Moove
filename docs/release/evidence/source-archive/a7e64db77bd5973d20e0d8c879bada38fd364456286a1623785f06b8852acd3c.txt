import Foundation

enum RideChatMessageWire {
    static func message(_ data: [String: Any], position: RideChatPosition, uid: RideChatID,
        reference: RideChatReference) throws -> RideChatMessage {
        try RideChatWire.require(RideChatWire.reference(data) == reference)
        let participants = try RideChatWire.ids(data["participantUserIds"]), sender = try RideChatWire.id(data["senderUserId"])
        try RideChatWire.require(participants.contains(uid) && participants.contains(sender))
        let body = try RideChatWire.text(data["body"], maximum: 1_000)
        let readers = try data.keys.contains("readByUserIds") ? RideChatWire.ids(data["readByUserIds"]) : []
        try RideChatWire.require(Set(readers).isSubset(of: Set(participants)))
        var request: UUID?
        if let value = data["clientMessageId"] {
            guard let value = value as? String, let parsed = UUID(uuidString: value) else { throw RideChatError.invalidResponse }
            request = parsed
        }
        return .init(id: position.id, sender: sender, body: body, position: position, requestId: request,
            needsRead: sender != uid && !readers.contains(uid))
    }
    static func page(_ rows: [RideChatMessage], uid: RideChatID, reference: RideChatReference,
        after: RideChatPosition? = nil) throws -> RideChatPage {
        try RideChatWire.require(rows.count <= 51 && Set(rows.map(\.id)).count == rows.count)
        for row in rows { try RideChatWire.require(row.position.id == row.id && (after == nil || row.position < after!)) }
        for pair in zip(rows, rows.dropFirst()) { try RideChatWire.require(pair.0.position > pair.1.position) }
        let selected = Array(rows.prefix(50))
        return .init(uid: uid, reference: reference, messages: selected, older: rows.count > 50 ? selected.last?.position : nil)
    }
    static func sent(_ raw: Any?, uid: RideChatID, reference: RideChatReference, request: UUID) throws -> RideChatReceipt {
        let data = try RideChatWire.object(raw), id = try RideChatWire.id(data["messageId"])
        try RideChatWire.require(id.value == TeamChatIdentity.operation(uid: uid.value, requestId: request))
        try RideChatWire.require(RideChatWire.ids(data["participantUserIds"]).contains(uid))
        _ = try RideChatWire.boolean(data["reused"])
        return .init(uid: uid, reference: reference, requestId: request, messageId: id)
    }
    static func reads(_ raw: Any?, uid: RideChatID, reference: RideChatReference, ids: [RideChatID]) throws -> RideChatReadReceipt {
        let data = try RideChatWire.object(raw)
        try RideChatWire.require(RideChatWire.ids(data["readMessageIds"], maximum: 50) == ids)
        return .init(uid: uid, reference: reference, ids: ids)
    }
}
