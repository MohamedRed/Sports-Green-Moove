import Foundation
import Observation

@MainActor @Observable final class TeamChatDirectoryState {
    private(set) var items: [TeamChatChoice] = []
    private(set) var loaded = false
    private(set) var error: String?
    let clubId: String?
    private let access: AccountAccess
    private let gateway: any TeamChatGateway
    private var cursor: String?
    private var seen: Set<String> = []
    private var generation = UUID()
    private var active = true
    private var closed = false
    private var inFlight = 0
    var live: Bool { !closed && active && TeamChatPolicy.permits(access) }
    var busy: Bool { inFlight > 0 || access.waitingForEarlierWork }
    var hasMore: Bool { live && loaded && error == nil && cursor != nil }

    init(access: AccountAccess, clubId: String?, gateway: any TeamChatGateway) {
        self.access = access; self.clubId = clubId; self.gateway = gateway
    }
    private func clear() { generation = UUID(); items = []; cursor = nil; seen = []; loaded = false; error = nil }
    func suspend() { active = false; clear() }
    func close() { closed = true; suspend() }
    func resume() async { guard !closed else { return }; active = true; await refresh() }
    func refresh() async { await load(reset: true) }
    func more() async { if hasMore { await load(reset: false) } }
    func select(_ item: TeamChatChoice) -> TeamChatChoice? {
        guard live, !busy, loaded, error == nil, item.name != nil, items.contains(item) else { return nil }
        close(); return item
    }
    private func retain(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if live && generation == ticket && access.owns(work) { return true }
        if generation == ticket { clear() }; return false
    }
    private func load(reset: Bool) async {
        guard live, !busy, clubId == nil || TeamChatWire.validId(clubId!), let work = access.begin() else { return }
        defer { access.finish(work) }
        let requested = reset ? nil : cursor
        guard reset || requested != nil else { return }
        if reset { clear() }
        let ticket = generation; inFlight += 1
        defer { inFlight -= 1 }
        do {
            let next = try await gateway.teamChatChoices(uid: access.context.uid, clubId: clubId, cursor: requested)
            guard retain(ticket, work) else { return }
            try TeamChatWire.validateChoices(next, clubId: clubId)
            try TeamChatWire.require(!next.items.contains { row in items.contains { $0.id == row.id } })
            if let token = next.nextCursor { try TeamChatWire.require(token != requested && !seen.contains(token)) }
            if let requested { seen.insert(requested) }
            items += next.items; cursor = next.nextCursor; loaded = true
        } catch {
            guard retain(ticket, work) else { return }
            clear(); self.error = "Impossible de vérifier les équipes. Actualisez."
        }
    }
}
