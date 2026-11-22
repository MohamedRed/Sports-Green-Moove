import Foundation
import Observation

@MainActor @Observable final class RideChatBookingState {
    let uid: RideChatID
    private(set) var items: [RideChatBooking] = []
    private(set) var loaded = false
    private(set) var error: String?
    private let access: AccountAccess
    private let gateway: any RideChatGateway
    private var generation = UUID()
    private var active = false
    private var closed = false
    private var cursor: String?
    private var seen = Set<String>()
    private var inFlight = 0
    private var waiting: [CheckedContinuation<Void, Never>] = []
    var live: Bool { !closed && active && access.isCurrent && uid.value.utf8.elementsEqual(access.context.uid.utf8) }
    var busy: Bool { inFlight > 0 || access.waitingForEarlierWork }
    var hasMore: Bool { live && loaded && error == nil && cursor != nil }
    init(uid: RideChatID, access: AccountAccess, gateway: any RideChatGateway) { self.uid = uid; self.access = access; self.gateway = gateway }
    private func clear() { generation = UUID(); items = []; loaded = false; error = nil; cursor = nil; seen = [] }
    func suspend() { active = false; clear() }
    func close() { closed = true; suspend() }
    func run() async { guard !closed else { return }; active = true; await load(more: false) }
    func more() async { if hasMore { await load(more: true) } }
    private func load(more: Bool) async {
        let ticket = generation
        if inFlight > 0 { await withCheckedContinuation { waiting.append($0) } }
        guard live, ticket == generation, !busy, let work = access.begin() else { return }
        let requested = more ? cursor : nil
        guard !more || requested != nil else { access.finish(work); return }
        inFlight += 1
        defer {
            inFlight -= 1; access.finish(work)
            let waiters = waiting; waiting = []; waiters.forEach { $0.resume() }
        }
        if !more { items = []; loaded = false; cursor = nil; seen = [] }; error = nil
        do {
            let page = try await gateway.rideChatBookings(uid: uid, cursor: requested)
            guard live, generation == ticket, access.owns(work) else { return }
            try RideChatWire.require(page.uid == uid && page.items.count <= 20 && Set(page.items.map(\.reference)).count == page.items.count)
            try RideChatWire.require(page.items.allSatisfy { row in
                row.reference.kind == .booking && !items.contains(where: { $0.reference == row.reference })
            })
            if let next = page.nextCursor { _ = try RideChatWire.cursor(next); try RideChatWire.require(next != requested && !seen.contains(next)) }
            if let requested { seen.insert(requested) }
            items += page.items; cursor = page.nextCursor; loaded = true
        } catch {
            if live && generation == ticket && access.owns(work) { clear(); self.error = "Impossible de vérifier les réservations. Actualisez." }
        }
    }
    func selected(_ row: RideChatBooking) -> RideChatBooking? { live && loaded && !busy && error == nil && items.contains(row) ? row : nil }
}
