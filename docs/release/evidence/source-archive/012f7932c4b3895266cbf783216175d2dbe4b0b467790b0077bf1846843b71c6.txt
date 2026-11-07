import Foundation
import Observation

@MainActor @Observable final class ParentReservationState {
    private(set) var items: [ParentReservation] = []
    private(set) var cursor: String?
    private(set) var loaded = false
    private(set) var error: String?
    private(set) var confirmation: ParentCancellationReceipt?
    private(set) var requiresRefresh = false
    private let access: AccountAccess
    private let gateway: any ParentReservationGateway
    private var seen: Set<String> = []
    private var generation = UUID()
    private var active = true
    private var inFlight = 0
    var live: Bool { active && access.isCurrent && access.context.role == .parent && !access.context.grantedRoles.contains(.child) }
    var busy: Bool { inFlight > 0 || access.waitingForEarlierWork }
    var hasMore: Bool { live && loaded && !requiresRefresh && error == nil && cursor != nil }
    init(access: AccountAccess, gateway: any ParentReservationGateway) { self.access = access; self.gateway = gateway }
    private func clear() { items = []; cursor = nil; loaded = false; seen = [] }
    func suspend() { active = false; generation = UUID(); clear(); error = nil; confirmation = nil; requiresRefresh = false }
    func resume() async { guard access.isCurrent else { return }; active = true; await refresh() }
    private func retains(_ ticket: UUID, _ work: AccountWork) -> Bool { live && generation == ticket && access.owns(work) }
    func refresh() async { await load(more: false) }
    func more() async { if hasMore { await load(more: true) } }
    private func load(more: Bool) async {
        guard live, !busy, let work = access.begin() else { return }
        let requested = more ? cursor : nil, ticket = generation
        guard !more || requested != nil else { access.finish(work); return }
        inFlight += 1
        defer { inFlight -= 1; access.finish(work) }
        if !more { clear(); error = nil }
        do {
            let page = try await gateway.parentReservations(uid: access.context.uid, cursor: requested)
            guard retains(ticket, work) else { return }
            try ParentReservationWire.require(page.userId == access.context.uid && page.items.count <= 20)
            try ParentReservationWire.require(Set(page.items.map(\.id)).count == page.items.count)
            for row in page.items { try ParentReservationWire.validate(row, uid: access.context.uid) }
            let previous = more ? items : []
            try ParentReservationWire.require(!page.items.contains { row in previous.contains { $0.id == row.id } })
            if let requested { try ParentReservationWire.require(!seen.contains(requested)); seen.insert(requested) }
            if let next = page.cursor {
                _ = try ParentReservationWire.cursor(next)
                try ParentReservationWire.require(next != requested && !seen.contains(next))
            }
            items = previous + page.items; cursor = page.cursor; loaded = true; error = nil; requiresRefresh = false
        } catch {
            if retains(ticket, work) { clear(); requiresRefresh = true; self.error = "Impossible de vérifier vos réservations. Actualisez." }
        }
    }
    func canCancel(_ row: ParentReservation) -> Bool {
        live && !busy && loaded && !requiresRefresh && error == nil && row.canCancel && items.contains(row)
    }
    func cancel(_ row: ParentReservation) async {
        guard canCancel(row), let work = access.begin() else { return }
        let ticket = generation; inFlight += 1; requiresRefresh = true; confirmation = nil; error = nil
        defer { inFlight -= 1; access.finish(work) }
        do {
            let receipt = try await gateway.cancelParentReservation(uid: access.context.uid, bookingId: row.id)
            guard retains(ticket, work) else { return }
            try ParentReservationWire.require(receipt.bookingId == row.id)
            confirmation = receipt; clear()
        } catch {
            if retains(ticket, work) {
                clear(); self.error = "Annulation non confirmée. Actualisez avant de réessayer."
            }
        }
    }
}
