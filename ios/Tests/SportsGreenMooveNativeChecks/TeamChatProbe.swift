import Foundation

let isolatedTeamTarget = TeamChatTarget(teamId: "isolated-team", instanceId: String(repeating: "a", count: 64))
let isolatedTeamVersion = String(repeating: "b", count: 64)

func isolatedTeamMessage(_ number: Int, sender: String = "driver", body: String? = nil, needsRead: Bool = true) -> TeamChatMessage {
    let request = UUID(uuidString: "00000000-0000-4000-8000-" + String(format: "%012x", number))!
    return .init(id: try! TeamChatIdentity.operation(uid: sender, requestId: request), senderId: sender,
        author: "Synthetic author", body: body ?? "Synthetic message \(number)", requestId: request,
        sequence: Int64(number), seconds: Int64(number), nanos: 0, needsRead: sender == "parent" ? false : needsRead)
}
func isolatedTeamPage(_ rows: [TeamChatMessage] = [isolatedTeamMessage(2)], cursor: String? = nil,
    version: String = isolatedTeamVersion) -> TeamChatPage {
    .init(title: "Synthetic team", accessVersion: version, items: rows.sorted(by: TeamChatMessage.newer), nextCursor: cursor)
}

actor TeamChatProbe: TeamChatGateway {
    private var reply: CheckedContinuation<Void, Error>?
    private var suspended = false
    private var arrivals: [Int: CheckedContinuation<Void, Never>] = [:]
    private var watchdogs: [Int: Task<Void, Never>] = [:]
    private var count = 0
    private(set) var names: [String] = []
    private(set) var sends: [TeamChatDraft] = []
    private(set) var reads: [[String]] = []
    private var page = isolatedTeamPage()
    private var choices = TeamChatChoices(items: [.init(id: "club", name: "Synthetic club", instanceId: nil, unreadCount: nil)], nextCursor: nil)
    private var sendReceipt: String?
    private var commit = false
    func configure(page: TeamChatPage? = nil, choices: TeamChatChoices? = nil, suspend: Bool = false,
        sendReceipt: String? = nil, commit: Bool = false) {
        if let page { self.page = page }; if let choices { self.choices = choices }
        suspended = suspend; self.sendReceipt = sendReceipt; self.commit = commit
    }
    func waitForCall(_ number: Int) async {
        if count >= number { return }
        await withCheckedContinuation { continuation in
            arrivals[number] = continuation
            watchdogs[number] = Task { [weak self] in
                do { try await Task.sleep(for: .seconds(10)) } catch { return }
                await self?.requireArrival(number)
            }
        }
    }
    private func requireArrival(_ number: Int) { precondition(arrivals[number] == nil, "Expected isolated team call \(number) never started") }
    func release(_ error: TeamChatError? = nil) {
        if let error { reply?.resume(throwing: error) } else { reply?.resume() }; reply = nil
    }
    private func gate(_ name: String, uid: String) async throws {
        check(uid == "parent", "Team chat dispatched another account")
        names.append(name); count += 1; watchdogs.removeValue(forKey: count)?.cancel(); arrivals.removeValue(forKey: count)?.resume()
        if suspended { suspended = false; try await withCheckedThrowingContinuation { reply = $0 } }
    }
    func teamChatChoices(uid: String, clubId: String?, cursor: String?) async throws -> TeamChatChoices {
        let result = choices; try await gate("choices", uid: uid); return result
    }
    func teamChatMessages(uid: String, target: TeamChatTarget, cursor: String?) async throws -> TeamChatPage {
        check(target == isolatedTeamTarget, "Team history changed its exact target")
        let result = page; try await gate(cursor == nil ? "latest" : "earlier", uid: uid); return result
    }
    func sendTeamChat(uid: String, target: TeamChatTarget, body: String, requestId: UUID) async throws -> String {
        check(target == isolatedTeamTarget, "Team send changed its exact target")
        sends.append(.init(uid: uid, target: target, body: body, requestId: requestId))
        if commit {
            let id = try TeamChatIdentity.operation(uid: uid, requestId: requestId)
            let previous = page.items.first { $0.id == id }
            let sequence = previous?.sequence ?? ((page.items.map(\.sequence).max() ?? 0) + 1)
            let next = TeamChatMessage(id: id, senderId: uid,
                author: "Synthetic parent", body: body, requestId: requestId, sequence: sequence,
                seconds: previous?.seconds ?? (1_000 + sequence), nanos: 0, needsRead: false)
            page = isolatedTeamPage([next] + page.items.filter { $0.id != next.id })
        }
        try await gate("send", uid: uid)
        return try sendReceipt ?? TeamChatIdentity.operation(uid: uid, requestId: requestId)
    }
    func readTeamChat(uid: String, target: TeamChatTarget, accessVersion: String, ids: [String]) async throws {
        check(target == isolatedTeamTarget && accessVersion == isolatedTeamVersion, "Team read changed its subject or admission")
        reads.append(ids); try await gate("read", uid: uid)
    }
}

final class TeamChatStorageProbe: TeamChatDraftStorage, @unchecked Sendable {
    private let lock = NSLock()
    let store: TeamChatDraftStore
    private var failed = false
    private var readCount = 0
    var reads: Int { lock.lock(); defer { lock.unlock() }; return readCount }
    init(directory: URL) { store = .init(directory: directory) }
    func fail(_ value: Bool) { lock.lock(); defer { lock.unlock() }; failed = value }
    func read(uid: String, target: TeamChatTarget) throws -> TeamChatDraft? {
        lock.lock(); defer { lock.unlock() }; readCount += 1
        if failed { throw TeamChatError.storage }; return try store.read(uid: uid, target: target)
    }
    func write(_ draft: TeamChatDraft) throws {
        lock.lock(); defer { lock.unlock() }; if failed { throw TeamChatError.storage }; try store.write(draft)
    }
    func remove(_ draft: TeamChatDraft) throws {
        lock.lock(); defer { lock.unlock() }; if failed { throw TeamChatError.storage }; try store.remove(draft)
    }
    func releaseRejected(_ draft: TeamChatDraft) throws {
        lock.lock(); defer { lock.unlock() }; if failed { throw TeamChatError.storage }; try store.releaseRejected(draft)
    }
}

extension AppDataFixtureGateway {
    func teamChatChoices(uid: String, clubId: String?, cursor: String?) async throws -> TeamChatChoices {
        try await UnconfiguredFirebaseGateway().teamChatChoices(uid: uid, clubId: clubId, cursor: cursor)
    }
    func teamChatMessages(uid: String, target: TeamChatTarget, cursor: String?) async throws -> TeamChatPage {
        try await UnconfiguredFirebaseGateway().teamChatMessages(uid: uid, target: target, cursor: cursor)
    }
    func sendTeamChat(uid: String, target: TeamChatTarget, body: String, requestId: UUID) async throws -> String {
        try await UnconfiguredFirebaseGateway().sendTeamChat(uid: uid, target: target, body: body, requestId: requestId)
    }
    func readTeamChat(uid: String, target: TeamChatTarget, accessVersion: String, ids: [String]) async throws {
        try await UnconfiguredFirebaseGateway().readTeamChat(uid: uid, target: target, accessVersion: accessVersion, ids: ids)
    }
}
