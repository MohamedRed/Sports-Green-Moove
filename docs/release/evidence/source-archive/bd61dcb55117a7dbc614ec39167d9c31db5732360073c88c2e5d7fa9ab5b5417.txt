import Foundation

enum RideChatError: Error, Equatable { case invalidResponse, accessRejected, sendRejected, storage, unavailable }

// Document identities are opaque bytes, not canonically equivalent display text.
struct RideChatID: Codable, Hashable, Comparable, Sendable {
    let value: String
    init(_ value: String) throws {
        guard !value.isEmpty, value.utf16.count <= 256, !value.contains("/"), value != ".", value != "..",
              !(value.hasPrefix("__") && value.hasSuffix("__")) else { throw RideChatError.invalidResponse }
        self.value = value
    }
    static func == (lhs: Self, rhs: Self) -> Bool { lhs.value.utf8.elementsEqual(rhs.value.utf8) }
    static func < (lhs: Self, rhs: Self) -> Bool { lhs.value.utf8.lexicographicallyPrecedes(rhs.value.utf8) }
    func hash(into hasher: inout Hasher) { hasher.combine(Data(value.utf8)) }
    init(from decoder: any Decoder) throws { try self.init(decoder.singleValueContainer().decode(String.self)) }
    func encode(to encoder: any Encoder) throws { var container = encoder.singleValueContainer(); try container.encode(value) }
}

struct RideChatReference: Codable, Hashable, Sendable {
    enum Kind: String, Codable, Sendable { case booking, rideSession }
    let kind: Kind
    let sourceId: RideChatID
    var sourceCollection: String { kind == .booking ? "bookings" : "rideSessions" }
    var sendKey: String { kind == .booking ? "bookingId" : "rideSessionId" }
    var payload: [String: Any] { ["sourceType": kind.rawValue, "sourceId": sourceId.value] }
    func inboxId(uid: RideChatID) throws -> RideChatID {
        try RideChatID(TeamChatIdentity.digest([uid.value, kind.rawValue, sourceId.value]))
    }
}

enum RideChatText {
    static func normalized(_ value: String) -> String { TeamChatText.normalized(value) }
    static func valid(_ value: String) -> Bool { !normalized(value).isEmpty && normalized(value).utf16.count <= 1_000 }
    static func same(_ lhs: String, _ rhs: String) -> Bool { lhs.utf16.elementsEqual(rhs.utf16) }
}
