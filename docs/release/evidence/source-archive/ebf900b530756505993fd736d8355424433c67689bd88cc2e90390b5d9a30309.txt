import Foundation
import Observation

@MainActor @Observable final class ReceivedRatingsState {
    private(set) var summary: ReceivedRatingSummary?
    private(set) var error: String?
    private let access: AccountAccess
    private let gateway: any ReceivedRatingsGateway
    private var generation = UUID()
    private var active = true
    private var closed = false
    private var inFlight = 0
    var live: Bool { !closed && active && access.isCurrent }
    var busy: Bool { inFlight > 0 || access.waitingForEarlierWork }

    init(access: AccountAccess, gateway: any ReceivedRatingsGateway) { self.access = access; self.gateway = gateway }
    private func clear() { generation = UUID(); summary = nil; error = nil }
    func suspend() { active = false; clear() }
    func close() { closed = true; suspend() }
    func resume() async { guard !closed else { return }; active = true; await refresh() }
    private func retain(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if live && generation == ticket && access.owns(work) { return true }
        if generation == ticket { clear() }; return false
    }
    func refresh() async {
        guard live, !busy, let work = access.begin() else { return }
        clear(); let ticket = generation; inFlight += 1
        defer { inFlight -= 1; access.finish(work) }
        do {
            let result = try await gateway.receivedRatings(uid: access.context.uid)
            guard retain(ticket, work) else { return }
            try result.validate(uid: access.context.uid); summary = result
        } catch {
            guard retain(ticket, work) else { return }
            self.error = "Impossible de charger vos avis. Réessayez."
        }
    }
}
