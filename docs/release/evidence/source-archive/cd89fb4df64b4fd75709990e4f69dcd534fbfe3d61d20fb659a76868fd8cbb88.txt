import Foundation

let rideChatOwner = try! RideChatID("parent")
let rideChatDriver = try! RideChatID("driver")
let rideChatReference = RideChatReference(kind: .booking, sourceId: try! RideChatID("isolated-booking"))
let rideChatContext = RideChatContext(title: "Entraînement isolé", departureLabel: "30 novembre", peerLabel: "Conducteur", childLabel: "Enfant fictif")
func rideChatRow(_ number: Int, sender: RideChatID = rideChatDriver, body: String? = nil, request: UUID? = nil) -> RideChatMessage {
    let id = try! RideChatID(request.map { try! TeamChatIdentity.operation(uid: sender.value, requestId: $0) } ?? "message-\(number)")
    return .init(id: id, sender: sender, body: body ?? "Message \(number)",
        position: try! .init(seconds: Int64(number), nanos: 0, id: id), requestId: request, needsRead: sender != rideChatOwner)
}
func rideChatPage(_ range: ClosedRange<Int> = 2...51, more: Bool = true) -> RideChatPage {
    let rows = range.reversed().map { rideChatRow($0) }
    return .init(uid: rideChatOwner, reference: rideChatReference, messages: rows, older: more ? rows.last?.position : nil)
}
func rideChatDirectoryRow(_ number: Int, revision: Int64 = 1, unread: Int64 = 2) -> RideChatDirectoryRow {
    let ref = RideChatReference(kind: .booking, sourceId: try! RideChatID("booking-\(number)")), id = try! ref.inboxId(uid: rideChatOwner)
    return .init(id: id, reference: ref, context: rideChatContext, preview: "Départ confirmé.", dateLabel: "Aujourd’hui",
        unreadCount: unread, revision: revision, position: try! .init(seconds: Int64(number), nanos: 0, id: id))
}
func rideChatDirectoryPage(_ rows: [RideChatDirectoryRow] = [rideChatDirectoryRow(2)], next: String? = nil) -> RideChatDirectoryPage {
    .init(uid: rideChatOwner, items: rows, excluded: [], newest: rows.first?.position, oldest: rows.last?.position, nextCursor: next)
}
@MainActor func rideChatScope() -> AccountWorkScope {
    let scope = AccountWorkScope(); rideChatReplace(scope); return scope
}
@MainActor func rideChatReplace(_ scope: AccountWorkScope, uid: String = "parent", role: AppRole = .parent) {
    scope.replace(session: .init(uid: uid, email: nil, displayName: nil, roles: [.parent, .driver]), role: role)
}
@MainActor func rideChatEventually(_ condition: () -> Bool, _ message: String) async {
    let deadline = ContinuousClock.now.advanced(by: .seconds(10))
    while !condition() { check(ContinuousClock.now < deadline, message); await Task.yield() }
}
@MainActor final class RideChatProbeWatch: RideChatWatch {
    let access: RideChatAccess
    let updates: AsyncThrowingStream<RideChatPage, any Error>
    let continuation: AsyncThrowingStream<RideChatPage, any Error>.Continuation
    private(set) var isCurrent = true
    private(set) var closes = 0
    init(uid: RideChatID = rideChatOwner, reference: RideChatReference = rideChatReference) {
        access = .init(uid: uid, reference: reference, title: "Conversation isolée", participants: [uid: "Parent", rideChatDriver: nil])
        (updates, continuation) = AsyncThrowingStream.makeStream()
    }
    func publish(_ page: RideChatPage) { continuation.yield(page) }
    func revoke() { isCurrent = false; continuation.finish(throwing: RideChatError.accessRejected) }
    func close() { guard isCurrent else { return }; isCurrent = false; closes += 1; continuation.finish() }
}
@MainActor final class RideChatProbeInbox: RideChatInboxWatch {
    let updates: AsyncThrowingStream<RideChatDirectorySignal, any Error>
    let continuation: AsyncThrowingStream<RideChatDirectorySignal, any Error>.Continuation
    private(set) var isCurrent = true
    private(set) var references = Set<RideChatReference>()
    var autoGrant = true
    init() { (updates, continuation) = AsyncThrowingStream.makeStream() }
    func setReferences(_ references: Set<RideChatReference>) throws {
        guard isCurrent else { throw RideChatError.accessRejected }
        if autoGrant {
            for ref in references.subtracting(self.references) { source(ref, [rideChatOwner, rideChatDriver]) }
        }
        self.references = references
    }
    func source(_ reference: RideChatReference, _ participants: Set<RideChatID>) { continuation.yield(.source(reference, participants: participants)) }
    func changed() { continuation.yield(.indexChanged) }
    func close() { isCurrent = false; continuation.finish() }
}
@MainActor final class RideChatProbe: RideChatGateway {
    let watch = RideChatProbeWatch()
    let inbox = RideChatProbeInbox()
    var page = rideChatPage()
    var older = rideChatPage(1...1, more: false)
    var directory = rideChatDirectoryPage()
    var bookings = RideChatBookingPage(uid: rideChatOwner, items: [.init(reference: rideChatReference, context: rideChatContext, status: .approved)], nextCursor: nil)
    var suspended = false
    var reply: CheckedContinuation<Void, any Error>?
    var names: [String] = []
    var sends: [RideChatDraft] = []
    var reads: [[RideChatID]] = []
    var commit = false
    var malformedReceipt = false
    private func gate(_ name: String, _ uid: RideChatID) async throws {
        check(uid == rideChatOwner, "Ride chat adopted a foreign owner"); names.append(name)
        if suspended { suspended = false; try await withCheckedThrowingContinuation { reply = $0 } }
    }
    func release(_ error: (any Error)? = nil) {
        let pending = reply; reply = nil
        if let error { pending?.resume(throwing: error) } else { pending?.resume() }
    }
    func rideChatDirectory(uid: RideChatID, cursor: String?) async throws -> RideChatDirectoryPage {
        let result = directory; try await gate("directory", uid); return result
    }
    func rideChatBookings(uid: RideChatID, cursor: String?) async throws -> RideChatBookingPage {
        let result = bookings; try await gate("bookings", uid); return result
    }
    func openRideChat(uid: RideChatID, reference: RideChatReference) async throws -> any RideChatWatch {
        try await gate("open", uid); watch.publish(page); return watch
    }
    func observeRideChatInbox(uid: RideChatID) throws -> any RideChatInboxWatch {
        check(uid == rideChatOwner, "Inbox adopted a foreign owner"); names.append("observe"); return inbox
    }
    func earlierRideChat(uid: RideChatID, reference: RideChatReference, cursor: RideChatPosition) async throws -> RideChatPage {
        let result = older; try await gate("earlier", uid); return result
    }
    func sendRideChat(uid: RideChatID, reference: RideChatReference, body: String, requestId: UUID) async throws -> RideChatReceipt {
        sends.append(.init(uid: uid, reference: reference, body: body, requestId: requestId))
        if commit {
            let sent = rideChatRow(100, sender: uid, body: body, request: requestId)
            let rows = [sent] + page.messages.filter { $0.id != sent.id }
            page = .init(uid: uid, reference: reference, messages: Array(rows.prefix(50)), older: rows.prefix(50).last?.position)
        }
        try await gate("send", uid)
        return try .init(uid: uid, reference: reference, requestId: requestId,
            messageId: RideChatID(malformedReceipt ? "foreign-receipt" : TeamChatIdentity.operation(uid: uid.value, requestId: requestId)))
    }
    func readRideChat(uid: RideChatID, reference: RideChatReference, ids: [RideChatID]) async throws -> RideChatReadReceipt {
        reads.append(ids); try await gate("read", uid)
        return .init(uid: uid, reference: reference, ids: malformedReceipt ? [] : ids)
    }
}
