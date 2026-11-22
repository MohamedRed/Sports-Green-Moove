import Foundation
import Observation

@MainActor @Observable final class MembershipReviewState {
    private(set) var clubs: [MembershipChoice] = []
    private(set) var items: [MembershipReview] = []
    private(set) var club: MembershipChoice?
    private(set) var loaded = false
    private(set) var error: String?
    private(set) var writeError: String?
    private(set) var requiresRefresh = false
    private let access: AccountAccess
    private let gateway: any MembershipGateway
    private var clubPager = MembershipPager<MembershipChoice>()
    private var memberPager = MembershipPager<MembershipReview>()
    private var generation = UUID()
    private var active = true
    private var closed = false
    private var inFlight = 0
    var live: Bool { !closed && active && MembershipPolicy.review(access) }
    var busy: Bool { inFlight > 0 || access.waitingForEarlierWork }
    var hasMore: Bool { live && loaded && error == nil && !requiresRefresh && (club == nil ? clubPager.cursor : memberPager.cursor) != nil }
    var canDecide: Bool { live && loaded && club != nil && error == nil && !requiresRefresh && !busy }
    init(access: AccountAccess, gateway: any MembershipGateway) { self.access = access; self.gateway = gateway }
    private func clearLists() {
        generation = UUID(); clubs = []; items = []; clubPager = .init(); memberPager = .init()
        loaded = false; error = nil; writeError = nil; requiresRefresh = false
    }
    func suspend() { active = false; clearLists(); club = nil }
    func close() { closed = true; suspend() }
    func resume() async { guard !closed else { return }; active = true; await refresh() }
    private func retain(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if live && generation == ticket && access.owns(work) { return true }
        if generation == ticket { clearLists(); club = nil }; return false
    }
    func refresh() async { await load(more: false) }
    func more() async { if hasMore { await load(more: true) } }
    func select(_ choice: MembershipChoice) async {
        guard live, !busy, loaded, error == nil, clubs.contains(choice) else { return }
        clearLists(); club = choice; await refresh()
    }
    func back() async {
        guard live, !busy else { return }; clearLists(); club = nil; await refresh()
    }
    private func load(more: Bool) async {
        guard live, !busy, let work = access.begin() else { return }
        let cursor = more ? (club == nil ? clubPager.cursor : memberPager.cursor) : nil
        guard !more || cursor != nil else { access.finish(work); return }
        let ticket = generation, selected = club; inFlight += 1
        defer { inFlight -= 1; access.finish(work) }
        if !more { items = []; clubs = []; loaded = false; error = nil }
        do {
            if let selected {
                let page = try await gateway.membershipReviews(uid: access.context.uid, clubId: selected.id, cursor: cursor)
                guard retain(ticket, work) else { return }
                for row in page.items {
                    try MembershipWire.require(MembershipWire.id(row.userId) && row.id == row.userId + "_" + selected.id)
                    _ = try MembershipWire.text(row.name); _ = try MembershipWire.text(row.team)
                    _ = try MembershipWire.requiredText(row.role, maximum: 80); _ = try MembershipWire.requiredText(row.status, maximum: 80)
                    _ = try MembershipWire.version(row.version)
                    try MembershipWire.require(row.actions.isEmpty || row.role == "member" && row.status == "requested" && !row.active && row.actions == [.approve, .reject])
                }
                try memberPager.apply(page, uid: access.context.uid, requested: cursor); items = memberPager.items
            } else {
                let page = try await gateway.membershipReviewClubs(uid: access.context.uid, cursor: cursor)
                guard retain(ticket, work) else { return }
                for row in page.items { _ = try MembershipWire.requiredText(row.name) }
                try clubPager.apply(page, uid: access.context.uid, requested: cursor); clubs = clubPager.items
            }
            loaded = true; error = nil; writeError = nil; requiresRefresh = false
        } catch { if retain(ticket, work) { clearLists(); club = nil; self.error = "Impossible de vérifier les adhésions. Actualisez." } }
    }
    func decide(_ row: MembershipReview, decision: MembershipDecision) async -> Bool {
        guard canDecide, row.canDecide, items.contains(row), let work = access.begin() else { return false }
        let ticket = generation; inFlight += 1; writeError = nil; requiresRefresh = true
        defer { inFlight -= 1; access.finish(work) }
        do {
            let receipt = try await gateway.decideMembership(uid: access.context.uid, row: row, decision: decision)
            guard retain(ticket, work) else { return false }
            try MembershipWire.require(receipt.id == row.id && receipt.status == (decision == .approve ? "active" : "rejected") && MembershipWire.id(receipt.reviewId))
            return true
        } catch {
            if retain(ticket, work) { writeError = "Décision non confirmée. Actualisez avant de réessayer." }
            return false
        }
    }
}
