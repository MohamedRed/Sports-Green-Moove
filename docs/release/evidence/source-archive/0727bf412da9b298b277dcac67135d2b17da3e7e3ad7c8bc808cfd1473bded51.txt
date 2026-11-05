import Foundation

struct RideChatDraft: Codable, Equatable, Sendable {
    let uid: RideChatID
    let reference: RideChatReference
    let body: String
    let requestId: UUID?
    static func == (a: Self, b: Self) -> Bool {
        a.uid == b.uid && a.reference == b.reference && RideChatText.same(a.body, b.body) && a.requestId == b.requestId
    }
}
protocol RideChatDraftStorage: Sendable {
    func read(uid: RideChatID, reference: RideChatReference) throws -> RideChatDraft?
    func write(_ draft: RideChatDraft) throws
    func remove(_ expected: RideChatDraft) throws
    func releaseRejected(_ expected: RideChatDraft) throws
}
struct RideChatDraftStore: RideChatDraftStorage {
    let directory: URL
    static func platformStore() throws -> Self { try .init(directory: PrivateChatDraftFiles.directory("ride-drafts")) }
    private func file(_ uid: RideChatID, _ reference: RideChatReference) throws -> URL {
        try directory.appendingPathComponent(reference.inboxId(uid: uid).value + ".json")
    }
    private func validate(_ draft: RideChatDraft) throws {
        try RideChatWire.require(draft.body.utf16.count <= 16_384 && (draft.requestId == nil || RideChatText.valid(draft.body)))
    }
    private func readUnlocked(uid: RideChatID, reference: RideChatReference) throws -> RideChatDraft? {
        guard let row = try PrivateChatDraftFiles.read(RideChatDraft.self, from: file(uid, reference)) else { return nil }
        try validate(row); try RideChatWire.require(row.uid == uid && row.reference == reference); return row
    }
    func read(uid: RideChatID, reference: RideChatReference) throws -> RideChatDraft? {
        PrivateChatDraftFiles.lock.lock(); defer { PrivateChatDraftFiles.lock.unlock() }
        return try readUnlocked(uid: uid, reference: reference)
    }
    func write(_ draft: RideChatDraft) throws {
        PrivateChatDraftFiles.lock.lock(); defer { PrivateChatDraftFiles.lock.unlock() }; try validate(draft)
        if let previous = try readUnlocked(uid: draft.uid, reference: draft.reference), previous.requestId != nil {
            try RideChatWire.require(previous == draft)
        }
        try PrivateChatDraftFiles.write(draft, to: file(draft.uid, draft.reference))
    }
    func remove(_ expected: RideChatDraft) throws {
        PrivateChatDraftFiles.lock.lock(); defer { PrivateChatDraftFiles.lock.unlock() }
        guard let row = try readUnlocked(uid: expected.uid, reference: expected.reference) else { return }
        try RideChatWire.require(row == expected)
        try FileManager.default.removeItem(at: file(expected.uid, expected.reference))
    }
    func releaseRejected(_ expected: RideChatDraft) throws {
        PrivateChatDraftFiles.lock.lock(); defer { PrivateChatDraftFiles.lock.unlock() }
        try RideChatWire.require(readUnlocked(uid: expected.uid, reference: expected.reference) == expected)
        try PrivateChatDraftFiles.write(RideChatDraft(uid: expected.uid, reference: expected.reference, body: expected.body, requestId: nil),
            to: file(expected.uid, expected.reference))
    }
}
