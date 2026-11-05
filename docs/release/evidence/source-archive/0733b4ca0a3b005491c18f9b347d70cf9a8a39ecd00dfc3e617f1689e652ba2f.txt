import Foundation

enum RideChatSourcePolicy {
    static func allows(_ data: [String: Any]?, uid: RideChatID, reference: RideChatReference) throws -> Bool {
        try participants(data, reference: reference).contains(uid)
    }
    static func participants(_ data: [String: Any]?, reference: RideChatReference) throws -> Set<RideChatID> {
        guard let data else { return [] }
        var raw: [Any] = []
        if reference.kind == .booking {
            let parent = data["parentUserId"]
            if parent == nil || parent is NSNull { raw.append(data["requesterUserId"] ?? NSNull()) }
            else { raw.append(parent!) }
        } else {
            for key in ["participantUserIds", "childUserIds"] {
                if let value = data[key] {
                    guard let values = value as? [Any] else { throw RideChatError.invalidResponse }; raw += values
                }
            }
        }
        raw.append(data["driverUserId"] ?? NSNull())
        // The server filters falsy values, then rejects truthy non-string identities.
        var participants = Set<RideChatID>()
        for value in raw {
            if value is NSNull { continue }
            if let text = value as? String {
                if !text.isEmpty { participants.insert(try RideChatID(text)) }; continue
            }
            if let number = value as? NSNumber, number.doubleValue == 0 || number.doubleValue.isNaN { continue }
            throw RideChatError.invalidResponse
        }
        try RideChatWire.require(participants.count <= 100); return participants
    }
}
