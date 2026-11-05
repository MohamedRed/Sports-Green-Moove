import Foundation
import Observation

@MainActor @Observable final class GuardianContactState {
    private(set) var items: [GuardianContactRecord] = []
    private(set) var busy = false
    private(set) var loaded = false
    private(set) var error: String?
    private let access: AccountAccess
    private let gateway: any EmergencyContactGateway
    private var cursor: String?
    private var seen: Set<String> = []
    private var generation = UUID()
    private var foreground = true
    private var closed = false
    var choices: [GuardianContactRecord] { items.filter { $0.status == .verified } }
    var hasMore: Bool { live && error == nil && cursor != nil }
    private var live: Bool { !closed && foreground && access.isCurrent && access.context.role == .parent && !access.context.grantedRoles.contains(.child) }

    init(access: AccountAccess, gateway: any EmergencyContactGateway) { self.access = access; self.gateway = gateway }
    private func clear() { generation = UUID(); items = []; cursor = nil; seen = []; busy = false; loaded = false; error = nil }
    func suspend() { foreground = false; clear() }
    func close() { closed = true; suspend() }
    func resume() async { guard !closed else { return }; foreground = true; await refresh() }
    func refresh() async { await load(reset: true) }
    func more() async { if hasMore && loaded { await load(reset: false) } }
    func select(_ choice: GuardianContactRecord) -> EmergencyContactTarget? {
        guard live, !busy, loaded, error == nil, choice.selectable, items.contains(choice) else { return nil }
        let target = choice.target; close(); return target
    }
    func personal() -> EmergencyContactTarget? {
        guard live, !busy else { return nil }
        close(); return .personal
    }
    private func retainCurrent(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if live && generation == ticket && access.owns(work) { return true }
        if generation == ticket { clear() }
        return false
    }
    private func load(reset: Bool) async {
        guard live, !busy, let work = access.begin() else { return }
        defer { access.finish(work) }
        let requested = reset ? nil : cursor
        guard reset || requested != nil else { return }
        if reset { clear() }
        let ticket = generation; busy = true; error = nil
        defer { if generation == ticket { busy = false } }
        do {
            let page = try await gateway.guardianContacts(uid: access.context.uid, cursor: requested)
            try access.requireCurrent(work); guard retainCurrent(ticket, work) else { return }
            try GuardianContactWire.validate(page, uid: access.context.uid)
            try EmergencyContactWire.require(!page.items.contains { next in items.contains { $0.id == next.id || $0.target == next.target } })
            if let next = page.nextCursor { try EmergencyContactWire.require(next != requested && !seen.contains(next)) }
            if let requested { seen.insert(requested) }
            items += page.items; cursor = page.nextCursor; loaded = true
        } catch {
            guard retainCurrent(ticket, work) else { return }
            clear(); self.error = "Impossible de charger les liens vérifiés. Actualisez."
        }
    }
}
