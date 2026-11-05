import Foundation
import Observation

@MainActor @Observable final class RideChatDirectoryState {
    let uid: RideChatID
    private(set) var items: [RideChatDirectoryRow] = []
    private(set) var loaded = false
    private(set) var error: String?
    private(set) var earlierError: String?
    private(set) var hasMore = false
    private let access: AccountAccess
    private let gateway: any RideChatGateway
    private var timeline: RideChatDirectoryTimeline
    private var memberships: [RideChatReference: Set<RideChatID>] = [:]
    private var revoked = Set<RideChatReference>()
    private var watch: (any RideChatInboxWatch)?
    private var generation = UUID()
    private var active = false
    private var closed = false
    private var running = false
    private var inFlight = 0
    private var waiting: [CheckedContinuation<Void, Never>] = []
    private var loadTask: Task<Void, Never>?
    private var loadId: UUID?
    private var refreshNeeded = false
    var live: Bool { !closed && active && access.isCurrent && uid.value.utf8.elementsEqual(access.context.uid.utf8) }
    var busy: Bool { inFlight > 0 || access.waitingForEarlierWork }
    var verifying: Bool { live && error == nil && (!loaded || timeline.items.count > items.count) }
    var unreadCount: Int? {
        guard live, loaded, error == nil, !busy, !verifying, timeline.nextCursor == nil else { return nil }
        var total: Int64 = 0
        for row in items {
            let next = total.addingReportingOverflow(row.unreadCount); if next.overflow { return nil }; total = next.partialValue
        }
        return Int(exactly: total)
    }
    init(uid: RideChatID, access: AccountAccess, gateway: any RideChatGateway) {
        self.uid = uid; self.access = access; self.gateway = gateway; timeline = .init(uid: uid)
    }
    private func clear() {
        timeline = .init(uid: uid); items = []; loaded = false; memberships = [:]; revoked = []
        error = nil; earlierError = nil; hasMore = false; refreshNeeded = false
    }
    func suspend() {
        active = false; generation = UUID(); watch?.close(); watch = nil; loadTask?.cancel(); clear()
    }
    func close() { closed = true; suspend() }
    private func owns(_ ticket: UUID, _ work: AccountWork) -> Bool { live && generation == ticket && access.owns(work) }
    private func fail() {
        generation = UUID(); watch?.close(); watch = nil; loadTask?.cancel(); clear()
        error = "Impossible de vérifier les conversations. Actualisez."
    }
    func run() async {
        guard !closed else { return }; active = true; let ticket = generation
        if running { await withCheckedContinuation { waiting.append($0) } }
        guard live, ticket == generation, !running, let work = access.begin() else { return }
        running = true; var opened: (any RideChatInboxWatch)?
        defer {
            opened?.close()
            if generation == ticket { watch = nil; if !live || Task.isCancelled { suspend() } }
            access.finish(work); running = false
            let waiters = waiting; waiting = []; waiters.forEach { $0.resume() }
        }
        do {
            let stream = try gateway.observeRideChatInbox(uid: uid); opened = stream
            try RideChatWire.require(stream.isCurrent); watch = stream; requestRefresh()
            for try await event in stream.updates {
                guard owns(ticket, work) else { break }
                try RideChatWire.require(stream.isCurrent)
                switch event {
                case .indexChanged: requestRefresh()
                case let .source(reference, participants):
                    guard timeline.items.contains(where: { $0.reference == reference }) else { continue }
                    try RideChatWire.require(participants.count <= 100)
                    if !participants.contains(uid) {
                        revoked.insert(reference); memberships[reference] = nil; timeline.remove(reference)
                    } else if !revoked.contains(reference) {
                        let previous = memberships[reference]; memberships[reference] = participants
                        if previous != nil && previous != participants { requestRefresh() }
                    }
                    try publish()
                }
            }
            if owns(ticket, work) { fail() }
        } catch { if owns(ticket, work) { fail() } }
    }
    private func requestRefresh() { refreshNeeded = true; launchRefresh() }
    private func launchRefresh() {
        guard live, error == nil, watch?.isCurrent == true, loadTask == nil, !busy, refreshNeeded else { return }
        refreshNeeded = false; let id = UUID(); loadId = id
        loadTask = Task { @MainActor [weak self] in
            guard let self else { return }; await self.load(more: false)
            if self.loadId == id { self.loadId = nil; self.loadTask = nil }
            Task { @MainActor [weak self] in self?.launchRefresh() }
        }
    }
    func more() async { if hasMore { await load(more: true) } }
    private func load(more: Bool) async {
        guard live, !busy, watch?.isCurrent == true, let work = access.begin() else {
            if !more { refreshNeeded = true }; return
        }
        let ticket = generation, cursor = more ? timeline.nextCursor : nil
        guard !more || cursor != nil else { access.finish(work); return }
        inFlight += 1; earlierError = nil
        defer {
            inFlight -= 1; access.finish(work)
            Task { @MainActor [weak self] in self?.launchRefresh() }
        }
        do {
            let page = try await gateway.rideChatDirectory(uid: uid, cursor: cursor)
            guard owns(ticket, work) else { return }
            try RideChatWire.require(watch?.isCurrent == true && page.uid == uid)
            if let cursor { try timeline.earlier(page, cursor: cursor) } else { try timeline.latest(page) }
            for reference in revoked { timeline.remove(reference) }
            loaded = true; error = nil; try publish()
        } catch {
            guard owns(ticket, work) else { return }
            if more && !(error is RideChatError) { earlierError = "Impossible de charger les conversations précédentes. Réessayez." }
            else { fail() }
        }
    }
    private func publish() throws {
        let refs = Set(timeline.items.map(\.reference))
        memberships = memberships.filter { refs.contains($0.key) }
        try watch?.setReferences(refs)
        items = timeline.items.filter { memberships[$0.reference]?.contains(uid) == true && !revoked.contains($0.reference) }
        hasMore = timeline.nextCursor != nil
    }
    func selected(_ row: RideChatDirectoryRow) -> RideChatDirectoryRow? {
        live && loaded && error == nil && watch?.isCurrent == true && items.contains(row) ? row : nil
    }
}
