import Foundation
import CryptoKit

struct TeamChatTarget: Codable, Hashable, Sendable {
    let teamId: String
    let instanceId: String
}
struct TeamChatChoice: Identifiable, Equatable, Sendable {
    let id: String
    let name: String?
    let instanceId: String?
    let unreadCount: Int64?
}
struct TeamChatChoices: Equatable, Sendable {
    let items: [TeamChatChoice]
    let nextCursor: String?
}
struct TeamChatMessage: Identifiable, Equatable, Sendable {
    let id: String
    let senderId: String
    let author: String?
    let body: String
    let requestId: UUID
    let sequence: Int64
    let seconds: Int64
    let nanos: Int64
    var needsRead: Bool
    static func newer(_ a: Self, _ b: Self) -> Bool {
        if a.seconds != b.seconds { return a.seconds > b.seconds }
        if a.nanos != b.nanos { return a.nanos > b.nanos }
        return a.id > b.id
    }
    func sameContent(as other: Self) -> Bool {
        id == other.id && senderId == other.senderId && body == other.body && requestId == other.requestId &&
        sequence == other.sequence && seconds == other.seconds && nanos == other.nanos
    }
}
struct TeamChatPage: Equatable, Sendable {
    let title: String?
    let accessVersion: String
    let items: [TeamChatMessage]
    let nextCursor: String?
}
struct TeamChatDraft: Codable, Equatable, Sendable {
    let uid: String
    let target: TeamChatTarget
    let body: String
    let requestId: UUID?
}
enum TeamChatError: Error, Equatable { case invalidResponse, accessRejected, sendRejected, storage }
protocol TeamChatGateway: Sendable {
    func teamChatChoices(uid: String, clubId: String?, cursor: String?) async throws -> TeamChatChoices
    func teamChatMessages(uid: String, target: TeamChatTarget, cursor: String?) async throws -> TeamChatPage
    func sendTeamChat(uid: String, target: TeamChatTarget, body: String, requestId: UUID) async throws -> String
    func readTeamChat(uid: String, target: TeamChatTarget, accessVersion: String, ids: [String]) async throws
}
protocol TeamChatDraftStorage: Sendable {
    func read(uid: String, target: TeamChatTarget) throws -> TeamChatDraft?
    func write(_ draft: TeamChatDraft) throws
    func remove(_ draft: TeamChatDraft) throws
    func releaseRejected(_ draft: TeamChatDraft) throws
}
enum TeamChatIdentity {
    static func digest(_ parts: [String]) throws -> String {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.withoutEscapingSlashes]
        return SHA256.hash(data: try encoder.encode(parts)).map { String(format: "%02x", $0) }.joined()
    }
    static func operation(uid: String, requestId: UUID) throws -> String {
        try TeamChatWire.require(TeamChatWire.validId(uid))
        return try digest([uid, requestId.uuidString.lowercased()])
    }
}

enum TeamChatText {
    static func normalized(_ text: String) -> String {
        text.trimmingCharacters(in: CharacterSet(charactersIn: "\u{0009}\u{000a}\u{000b}\u{000c}\u{000d}\u{0020}\u{00a0}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200a}\u{2028}\u{2029}\u{202f}\u{205f}\u{3000}\u{feff}"))
    }
}
