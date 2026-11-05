import Foundation

#if DEBUG
private actor UITestTeamChat: TeamChatGateway {
    static let shared = UITestTeamChat()
    private let uid = "ui-user"
    private let target = TeamChatTarget(teamId: "ui-team", instanceId: String(repeating: "d", count: 64))
    private let version = String(repeating: "e", count: 64)
    private var sent: [TeamChatMessage] = []
    private var read: Set<String> = []
    private func row(_ number: Int, body: String) throws -> TeamChatMessage {
        let id = UUID(uuidString: "00000000-0000-4000-8000-" + String(format: "%012x", number))!
        let message = try TeamChatIdentity.operation(uid: "ui-coach", requestId: id)
        return .init(id: message, senderId: "ui-coach", author: "Coach Démo", body: body, requestId: id,
            sequence: Int64(number + 1), seconds: 1_800_000_000 + Int64(number), nanos: 0, needsRead: !read.contains(message))
    }
    func teamChatChoices(uid: String, clubId: String?, cursor: String?) async throws -> TeamChatChoices {
        guard uid == self.uid else { throw CancellationError() }
        guard cursor != nil else { return .init(items: [], nextCursor: "ui-page-two") }
        if clubId == nil { return .init(items: [.init(id: "ui-club", name: "Royal Ottignies Sports", instanceId: nil, unreadCount: nil)], nextCursor: nil) }
        guard clubId == "ui-club" else { throw TeamChatError.accessRejected }
        return .init(items: [.init(id: target.teamId, name: "U12 Ottignies", instanceId: target.instanceId,
            unreadCount: read.isEmpty ? 2 : 0)], nextCursor: nil)
    }
    func teamChatMessages(uid: String, target: TeamChatTarget, cursor: String?) async throws -> TeamChatPage {
        guard uid == self.uid, target == self.target else { throw TeamChatError.accessRejected }
        let items = try cursor == nil ? sent + [row(2, body: "Le départ est confirmé."), row(1, body: "Bienvenue dans l’équipe.")]
            : [row(0, body: "Rendez-vous au club.")]
        return .init(title: "U12 Ottignies", accessVersion: version, items: items.sorted(by: TeamChatMessage.newer),
            nextCursor: cursor == nil ? "ui-older" : nil)
    }
    func sendTeamChat(uid: String, target: TeamChatTarget, body: String, requestId: UUID) async throws -> String {
        guard uid == self.uid, target == self.target else { throw TeamChatError.sendRejected }
        let id = try TeamChatIdentity.operation(uid: uid, requestId: requestId)
        if !sent.contains(where: { $0.id == id }) {
            sent.append(.init(id: id, senderId: uid, author: "Parent Démo", body: body, requestId: requestId,
                sequence: Int64(100 + sent.count), seconds: Int64(1_800_000_100 + sent.count), nanos: 0, needsRead: false))
        }
        return id
    }
    func readTeamChat(uid: String, target: TeamChatTarget, accessVersion: String, ids: [String]) async throws {
        guard uid == self.uid, target == self.target, accessVersion == version else { throw TeamChatError.accessRejected }
        read.formUnion(ids)
    }
}

extension UITestFirebaseGateway {
    func teamChatChoices(uid: String, clubId: String?, cursor: String?) async throws -> TeamChatChoices {
        try await UITestTeamChat.shared.teamChatChoices(uid: uid, clubId: clubId, cursor: cursor)
    }
    func teamChatMessages(uid: String, target: TeamChatTarget, cursor: String?) async throws -> TeamChatPage {
        try await UITestTeamChat.shared.teamChatMessages(uid: uid, target: target, cursor: cursor)
    }
    func sendTeamChat(uid: String, target: TeamChatTarget, body: String, requestId: UUID) async throws -> String {
        try await UITestTeamChat.shared.sendTeamChat(uid: uid, target: target, body: body, requestId: requestId)
    }
    func readTeamChat(uid: String, target: TeamChatTarget, accessVersion: String, ids: [String]) async throws {
        try await UITestTeamChat.shared.readTeamChat(uid: uid, target: target, accessVersion: accessVersion, ids: ids)
    }
}
#endif
