import Foundation

#if DEBUG
@MainActor private final class UITestRideChat {
    static let shared = UITestRideChat()
    private var threads: [UITestRideChatWatch] = []
    private var inboxes: [UITestRideChatInboxWatch] = []
    private var sent: [RideChatReference: [RideChatMessage]] = [:]
    private var read: [RideChatReference: Set<RideChatID>] = [:]
    private var revision: Int64 = 1
    private func owner(_ uid: RideChatID) throws { guard uid.value == "ui-user" else { throw RideChatError.accessRejected } }
    private func references() throws -> [RideChatReference] {
        try [.init(kind: .booking, sourceId: RideChatID("booking-1")), .init(kind: .rideSession, sourceId: RideChatID("ride-session-1"))]
    }
    private func authorize(_ uid: RideChatID, _ reference: RideChatReference) throws {
        try owner(uid); guard try references().contains(reference) else { throw RideChatError.accessRejected }
    }
    private func context() -> RideChatContext {
        .init(title: "U8 Nationaux vs Royal Ottignies SC", departureLabel: "30 novembre à 16:45", peerLabel: "Conducteur Démo", childLabel: "Nora")
    }
    private func messages(_ uid: RideChatID, _ reference: RideChatReference) throws -> [RideChatMessage] {
        if reference.kind == .rideSession { return (sent[reference] ?? []).sorted { $0.position > $1.position } }
        let driver = try RideChatID("ui-driver")
        let existing = try (1...51).map { number -> RideChatMessage in
            let id = try RideChatID(String(format: "message-%03d", number))
            return try .init(id: id, sender: driver, body: number == 51 ? "Départ confirmé." : "Message de trajet \(number)",
                position: .init(seconds: Int64(1_800_000_000 + number), nanos: 0, id: id), requestId: nil,
                needsRead: !(read[reference]?.contains(id) ?? false))
        }
        return ((sent[reference] ?? []) + existing).sorted { $0.position > $1.position }
    }
    func directory(_ uid: RideChatID, _ cursor: String?) throws -> RideChatDirectoryPage {
        try owner(uid); guard cursor == nil else { throw RideChatError.invalidResponse }
        let rows = try references().compactMap { reference -> RideChatDirectoryRow? in
            let id = try reference.inboxId(uid: uid), messages = try messages(uid, reference)
            guard let last = messages.first else { return nil }
            return try .init(id: id, reference: reference, context: context(), preview: last.body, dateLabel: "Aujourd’hui",
                unreadCount: Int64(messages.filter(\.needsRead).count), revision: revision,
                position: .init(seconds: last.position.seconds, nanos: 0, id: id))
        }.sorted { $0.position > $1.position }
        return .init(uid: uid, items: rows, excluded: [], newest: rows.first?.position, oldest: rows.last?.position, nextCursor: nil)
    }
    func bookings(_ uid: RideChatID, _ cursor: String?) throws -> RideChatBookingPage {
        try owner(uid)
        if cursor == nil { return .init(uid: uid, items: [], nextCursor: "ui-second") }
        guard cursor == "ui-second", let ref = try references().first else { throw RideChatError.invalidResponse }
        return .init(uid: uid, items: [.init(reference: ref, context: context(), status: .approved)], nextCursor: nil)
    }
    func open(_ uid: RideChatID, _ reference: RideChatReference) throws -> any RideChatWatch {
        try authorize(uid, reference)
        let watch = try UITestRideChatWatch(access: .init(uid: uid, reference: reference, title: "Conversation de trajet",
            participants: [uid: "Parent Démo", RideChatID("ui-driver"): "Conducteur Démo"]))
        threads.removeAll { !$0.isCurrent }; threads.append(watch)
        watch.publish(try RideChatMessageWire.page(messages(uid, reference).prefix(51).map { $0 }, uid: uid, reference: reference))
        return watch
    }
    func inbox(_ uid: RideChatID) throws -> any RideChatInboxWatch {
        try owner(uid); let watch = try UITestRideChatInboxWatch(uid: uid, driver: RideChatID("ui-driver"))
        inboxes.removeAll { !$0.isCurrent }; inboxes.append(watch); return watch
    }
    func earlier(_ uid: RideChatID, _ reference: RideChatReference, _ cursor: RideChatPosition) throws -> RideChatPage {
        try authorize(uid, reference)
        return try RideChatMessageWire.page(Array(messages(uid, reference).filter { $0.position < cursor }.prefix(51)),
            uid: uid, reference: reference, after: cursor)
    }
    func send(_ uid: RideChatID, _ reference: RideChatReference, _ body: String, _ request: UUID) throws -> RideChatReceipt {
        try authorize(uid, reference); try RideChatWire.require(RideChatText.valid(body))
        let id = try RideChatID(TeamChatIdentity.operation(uid: uid.value, requestId: request))
        if let previous = sent[reference]?.first(where: { $0.id == id }) { try RideChatWire.require(RideChatText.same(previous.body, body)) }
        else {
            let row = try RideChatMessage(id: id, sender: uid, body: body,
                position: .init(seconds: Int64(1_800_001_000 + (sent[reference]?.count ?? 0)), nanos: 0, id: id), requestId: request, needsRead: false)
            sent[reference, default: []].append(row); revision += 1; try changed(uid, reference)
        }
        return .init(uid: uid, reference: reference, requestId: request, messageId: id)
    }
    func acknowledge(_ uid: RideChatID, _ reference: RideChatReference, _ ids: [RideChatID]) throws -> RideChatReadReceipt {
        try authorize(uid, reference)
        let known = Set(try messages(uid, reference).map(\.id)); try RideChatWire.require(ids.allSatisfy { known.contains($0) })
        read[reference, default: []].formUnion(ids); revision += 1; try changed(uid, reference)
        return .init(uid: uid, reference: reference, ids: ids)
    }
    private func changed(_ uid: RideChatID, _ reference: RideChatReference) throws {
        let page = try RideChatMessageWire.page(Array(messages(uid, reference).prefix(51)), uid: uid, reference: reference)
        for watch in threads where watch.isCurrent && watch.access.reference == reference { watch.publish(page) }
        for watch in inboxes where watch.isCurrent { watch.changed() }
    }
}
extension UITestFirebaseGateway {
    func rideChatDirectory(uid: RideChatID, cursor: String?) async throws -> RideChatDirectoryPage { try await UITestRideChat.shared.directory(uid, cursor) }
    func rideChatBookings(uid: RideChatID, cursor: String?) async throws -> RideChatBookingPage { try await UITestRideChat.shared.bookings(uid, cursor) }
    @MainActor func openRideChat(uid: RideChatID, reference: RideChatReference) async throws -> any RideChatWatch { try UITestRideChat.shared.open(uid, reference) }
    @MainActor func observeRideChatInbox(uid: RideChatID) throws -> any RideChatInboxWatch { try UITestRideChat.shared.inbox(uid) }
    func earlierRideChat(uid: RideChatID, reference: RideChatReference, cursor: RideChatPosition) async throws -> RideChatPage { try await UITestRideChat.shared.earlier(uid, reference, cursor) }
    func sendRideChat(uid: RideChatID, reference: RideChatReference, body: String, requestId: UUID) async throws -> RideChatReceipt { try await UITestRideChat.shared.send(uid, reference, body, requestId) }
    func readRideChat(uid: RideChatID, reference: RideChatReference, ids: [RideChatID]) async throws -> RideChatReadReceipt { try await UITestRideChat.shared.acknowledge(uid, reference, ids) }
}
#endif
