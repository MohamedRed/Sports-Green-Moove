import Foundation
import Observation

@MainActor @Observable final class ChildInvitationState {
    private(set) var current: ChildInvitationSummary?
    private(set) var loaded = false
    private(set) var busy = false
    private(set) var error: String?
    private var link: ChildInvitationLink?
    private let access: AccountAccess
    let target: ChildAccountTarget
    private let gateway: any ChildAccountGateway
    private let now: @Sendable () -> Int64
    private var generation = UUID()
    private var foreground = true
    private var closed = false
    private var live: Bool { !closed && foreground && access.isCurrent && access.context.role == .parent && !access.context.grantedRoles.contains(.child) }
    var canCreate: Bool { live && loaded && !busy && current?.status != .provisioning && current?.status != .accepted }
    var canRevoke: Bool { live && loaded && !busy && current?.status == .pending }

    init(access: AccountAccess, target: ChildAccountTarget, gateway: any ChildAccountGateway,
        now: @escaping @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) {
        self.access = access; self.target = target; self.gateway = gateway; self.now = now
    }
    private func clear() { generation = UUID(); current = nil; link = nil; loaded = false; error = nil }
    func suspend() { foreground = false; clear() }
    func close() { closed = true; suspend() }
    func resume() async { guard !closed else { return }; foreground = true; await refresh() }
    func sharingURL() -> URL? {
        guard live, loaded, !busy, let link, link.current == current else { return nil }
        do { try ChildInvitationWire.validate(link, target: target, now: now()); return link.url }
        catch { return nil }
    }
    private func retain(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if live && generation == ticket && access.owns(work) { return true }
        if generation == ticket { clear() }; return false
    }
    private func operation(_ action: () async throws -> (ChildInvitationSummary?, ChildInvitationLink?)) async {
        guard live, !busy, let work = access.begin() else { return }
        clear(); let ticket = generation; busy = true
        defer { access.finish(work); busy = false }
        do {
            _ = try ChildAccountWire.target(target)
            let (summary, created) = try await action()
            guard retain(ticket, work) else { return }
            if let summary { try ChildAccountWire.require(ChildAccountWire.hex(summary.invitationHash, count: 64) && summary.expiresAtMillis > 0) }
            if let created { try ChildInvitationWire.validate(created, target: target, now: now()) }
            current = summary; link = created; loaded = true
        } catch { if retain(ticket, work) { self.error = "Invitation non confirmée. Actualisez avant de réessayer." } }
    }
    func refresh() async { await operation { (try await gateway.childInvitation(uid: access.context.uid, target: target), nil) } }
    func create() async {
        guard canCreate else { return }
        await operation {
            let created = try await gateway.createChildInvitation(uid: access.context.uid, target: target)
            return (created.current, created)
        }
    }
    func revoke() async {
        guard canRevoke, let original = current else { return }
        await operation {
            try await gateway.revokeChildInvitation(uid: access.context.uid, target: target, hash: original.invitationHash)
            return (ChildInvitationSummary(invitationHash: original.invitationHash, status: .revoked, expiresAtMillis: original.expiresAtMillis), nil)
        }
    }
}
