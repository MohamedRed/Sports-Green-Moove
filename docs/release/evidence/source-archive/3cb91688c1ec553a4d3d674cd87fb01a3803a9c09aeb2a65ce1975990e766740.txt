import Foundation

struct TeamChatDraftStore: TeamChatDraftStorage {
    private static let lock = NSLock()
    let directory: URL
    static func platformStore() throws -> Self {
        let parent = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
            appropriateFor: nil, create: true)
        let directory = parent.appendingPathComponent("SportsGreenMoove/team-drafts", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        var url = directory; try url.setResourceValues(values)
        return .init(directory: directory)
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
        guard FileManager.default.fileExists(atPath: path.path) else { return nil }
        let values = try path.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
        try TeamChatWire.require(values.isRegularFile == true && values.isSymbolicLink != true && (values.fileSize ?? Int.max) <= 131_072)
        let row = try JSONDecoder().decode(TeamChatDraft.self, from: Data(contentsOf: path))
        try validate(row); try TeamChatWire.require(row.uid == uid && row.target == target); return row
    }
    func read(uid: String, target: TeamChatTarget) throws -> TeamChatDraft? {
        Self.lock.lock(); defer { Self.lock.unlock() }; return try readUnlocked(uid: uid, target: target)
    }
    func write(_ draft: TeamChatDraft) throws {
        Self.lock.lock(); defer { Self.lock.unlock() }; try validate(draft)
        if let previous = try readUnlocked(uid: draft.uid, target: draft.target), previous.requestId != nil {
            try TeamChatWire.require(previous == draft)
        }
        try writeUnlocked(draft)
    }
    private func writeUnlocked(_ draft: TeamChatDraft) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        #if os(iOS)
        try JSONEncoder().encode(draft).write(to: file(draft.uid, draft.target), options: [.atomic, .completeFileProtection])
        #else
        try JSONEncoder().encode(draft).write(to: file(draft.uid, draft.target), options: .atomic)
        #endif
    }
    func remove(_ expected: TeamChatDraft) throws {
        Self.lock.lock(); defer { Self.lock.unlock() }
        guard let row = try readUnlocked(uid: expected.uid, target: expected.target) else { return }
        try TeamChatWire.require(row == expected)
        try FileManager.default.removeItem(at: file(expected.uid, expected.target))
    }
    func releaseRejected(_ expected: TeamChatDraft) throws {
        Self.lock.lock(); defer { Self.lock.unlock() }
        try TeamChatWire.require(try readUnlocked(uid: expected.uid, target: expected.target) == expected)
        try writeUnlocked(.init(uid: expected.uid, target: expected.target, body: expected.body, requestId: nil))
    }
}
