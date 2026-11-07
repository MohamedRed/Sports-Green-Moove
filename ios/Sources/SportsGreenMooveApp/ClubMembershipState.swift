import Foundation
import Observation

@MainActor @Observable final class ClubMembershipState {
    private(set) var items: [MembershipClub] = []
    private(set) var loaded = false
    private(set) var error: String?
    private(set) var writeError: String?
    private(set) var requiresRefresh = false
    private let access: AccountAccess
    private let gateway: any MembershipGateway
    private var pager = MembershipPager<MembershipClub>()
    private var generation = UUID()
    private var active = true
    private var closed = false
    private var inFlight = 0
    var live: Bool { !closed && active && access.isCurrent }
    var busy: Bool { inFlight > 0 || access.waitingForEarlierWork }
    var hasMore: Bool { live && loaded && error == nil && !requiresRefresh && pager.cursor != nil }
    var canRequest: Bool { live && loaded && error == nil && !requiresRefresh && !busy && MembershipPolicy.request(access) }
    init(access: AccountAccess, gateway: any MembershipGateway) { self.access = access; self.gateway = gateway }
    private func clear() { generation = UUID(); pager = .init(); items = []; loaded = false; error = nil; writeError = nil; requiresRefresh = false }
    func suspend() { active = false; clear() }
    func close() { closed = true; suspend() }
    func resume() async { guard !closed else { return }; active = true; await refresh() }
    private func retain(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if live && generation == ticket && access.owns(work) { return true }
        if generation == ticket { clear() }; return false
    }
    func refresh() async { await load(more: false) }
    func more() async { if hasMore { await load(more: true) } }
    private func load(more: Bool) async {
        guard live, !busy, let work = access.begin() else { return }
        let cursor = more ? pager.cursor : nil
        guard !more || cursor != nil else { access.finish(work); return }
        let ticket = generation; inFlight += 1
        defer { inFlight -= 1; access.finish(work) }
        if !more { items = []; loaded = false; error = nil }
        do {
            let page = try await gateway.membershipClubs(uid: access.context.uid, cursor: cursor)
            guard retain(ticket, work) else { return }
            for row in page.items {
                _ = try MembershipWire.text(row.name); _ = try MembershipWire.text(row.sport)
                _ = try MembershipWire.text(row.status, maximum: 80)
                if let member = row.membership {
                    _ = try MembershipWire.requiredText(member.role, maximum: 80); _ = try MembershipWire.text(member.status, maximum: 80)
                }
                if let count = row.count { try MembershipWire.require((0...9_007_199_254_740_991).contains(count)) }
            }
            try pager.apply(page, uid: access.context.uid, requested: cursor)
            items = pager.items; loaded = true; error = nil; writeError = nil; requiresRefresh = false
        } catch { if retain(ticket, work) { clear(); self.error = "Impossible de vérifier les clubs. Actualisez." } }
    }
    func request(_ row: MembershipClub) async -> Bool {
        guard canRequest, row.requestable, items.contains(row), let work = access.begin() else { return false }
        let ticket = generation; inFlight += 1; writeError = nil; requiresRefresh = true
        defer { inFlight -= 1; access.finish(work) }
        do {
            let receipt = try await gateway.requestMembership(uid: access.context.uid, clubId: row.id)
            guard retain(ticket, work) else { return false }
            try MembershipWire.require(receipt.id == access.context.uid + "_" + row.id)
            _ = try MembershipWire.requiredText(receipt.status, maximum: 80)
            return true
        } catch {
            if retain(ticket, work) { writeError = "Demande non confirmée. Actualisez avant de réessayer." }
            return false
        }
    }
}
