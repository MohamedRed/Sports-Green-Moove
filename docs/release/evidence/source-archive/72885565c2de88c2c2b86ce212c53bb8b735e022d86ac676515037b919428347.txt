import Foundation
import Observation

@MainActor @Observable final class ChildAccountState {
    private(set) var code: ChildAccountCode?
    private(set) var approved = false
    private(set) var busy = false
    private(set) var error: String?
    private(set) var input = ""
    let target: ChildAccountTarget?
    private let access: AccountAccess
    private let gateway: any ChildAccountGateway
    private let now: @Sendable () -> Int64
    private var generation = UUID()
    private var foreground = true
    private var closed = false
    private var live: Bool { !closed && foreground && access.isCurrent }
    var isChild: Bool { access.context.role == .child && access.context.grantedRoles == [.child] }
    private var parent: Bool { access.context.role == .parent && !access.context.grantedRoles.contains(.child) }
    var canApprove: Bool { live && parent && target != nil && !busy && !approved && ChildAccountWire.hex(input, count: 32) }
    var canCreate: Bool { live && isChild && target == nil && !busy && activeCode == nil }
    var activeCode: ChildAccountCode? { live && code.map { $0.expiresAtMillis > now() } == true ? code : nil }

    init(access: AccountAccess, target: ChildAccountTarget?, gateway: any ChildAccountGateway,
        now: @escaping @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) {
        self.access = access; self.target = target; self.gateway = gateway; self.now = now
    }
    func edit(_ value: String) {
        guard live, parent, !busy, !approved else { return }
        input = String(value.filter { !$0.isWhitespace }.lowercased().prefix(128)); error = nil
    }
    func suspend() { foreground = false; clear() }
    func resume() { if !closed { foreground = true } }
    func close() { closed = true; suspend() }
    private func clear() { generation = UUID(); code = nil; input = ""; approved = false; error = nil }
    private func current(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if live && generation == ticket && access.owns(work) { return true }
        if generation == ticket { clear() }; return false
    }
    func create() async {
        guard canCreate, let work = access.begin() else { return }
        clear(); let ticket = generation; busy = true
        defer { access.finish(work); busy = false }
        do {
            let value = try await gateway.childAccountCode(uid: access.context.uid)
            guard current(ticket, work) else { return }
            try ChildAccountWire.require(value.accountUserId == access.context.uid && ChildAccountWire.hex(value.code, count: 32) && value.expiresAtMillis > now())
            code = value
        } catch { if current(ticket, work) { self.error = "Code indisponible. Réessayez." } }
    }
    func approve() async {
        guard canApprove, let target, let work = access.begin() else { return }
        let ticket = generation, submitted = input; busy = true; error = nil
        defer { access.finish(work); busy = false }
        do {
            _ = try ChildAccountWire.target(target)
            let value = try await gateway.approveChildAccount(uid: access.context.uid, target: target, code: submitted)
            guard current(ticket, work) else { return }
            try ChildAccountWire.require(EmergencyContactWire.validId(value.accountUserId) && value.accountUserId != access.context.uid &&
                value.childId == target.childId && value.childInstanceId == target.childInstanceId)
            input = ""; approved = true
        } catch { if current(ticket, work) { self.error = "Liaison non confirmée. Vérifiez le code avant de réessayer." } }
    }
}
