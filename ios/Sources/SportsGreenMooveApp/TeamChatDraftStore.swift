import Foundation

struct TeamChatDraftStore: TeamChatDraftStorage {
    let directory: URL
    static func platformStore() throws -> Self {
        try .init(directory: PrivateChatDraftFiles.directory("team-drafts"))
    }
    private func file(_ uid: String, _ target: TeamChatTarget) throws -> URL {
        try TeamChatWire.require(TeamChatWire.validId(uid)); _ = try TeamChatWire.target(target)
        let key = try TeamChatIdentity.digest([uid, target.teamId, target.instanceId])
        return directory.appendingPathComponent(key + ".json")
    }
    private func validate(_ draft: TeamChatDraft) throws {
        _ = try file(draft.uid, draft.target)
        try TeamChatWire.require(draft.body.utf16.count <= 16_384 &&
            (draft.requestId == nil || TeamChatWire.validBody(TeamChatText.normalized(draft.body))))
    }
    private func readUnlocked(uid: String, target: TeamChatTarget) throws -> TeamChatDraft? {
        let path = try file(uid, target)
        guard let row = try PrivateChatDraftFiles.read(TeamChatDraft.self, from: path) else { return nil }
        try validate(row); try TeamChatWire.require(row.uid == uid && row.target == target); return row
    }
    func read(uid: String, target: TeamChatTarget) throws -> TeamChatDraft? {
        PrivateChatDraftFiles.lock.lock(); defer { PrivateChatDraftFiles.lock.unlock() }; return try readUnlocked(uid: uid, target: target)
    }
    func write(_ draft: TeamChatDraft) throws {
        PrivateChatDraftFiles.lock.lock(); defer { PrivateChatDraftFiles.lock.unlock() }; try validate(draft)
        if let previous = try readUnlocked(uid: draft.uid, target: draft.target), previous.requestId != nil {
            try TeamChatWire.require(previous == draft)
        }
        try writeUnlocked(draft)
    }
    private func writeUnlocked(_ draft: TeamChatDraft) throws {
        try PrivateChatDraftFiles.write(draft, to: file(draft.uid, draft.target))
    }
    func remove(_ expected: TeamChatDraft) throws {
        PrivateChatDraftFiles.lock.lock(); defer { PrivateChatDraftFiles.lock.unlock() }
        guard let row = try readUnlocked(uid: expected.uid, target: expected.target) else { return }
        try TeamChatWire.require(row == expected)
        try FileManager.default.removeItem(at: file(expected.uid, expected.target))
    }
    func releaseRejected(_ expected: TeamChatDraft) throws {
        PrivateChatDraftFiles.lock.lock(); defer { PrivateChatDraftFiles.lock.unlock() }
        try TeamChatWire.require(try readUnlocked(uid: expected.uid, target: expected.target) == expected)
        try writeUnlocked(.init(uid: expected.uid, target: expected.target, body: expected.body, requestId: nil))
    }
}
