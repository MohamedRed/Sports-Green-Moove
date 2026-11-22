import Foundation
import Observation

@MainActor @Observable final class ProfileCityState {
    private(set) var view: ProfileCity?
    private(set) var pending: ProfileCityChange?
    private(set) var error: String?
    private(set) var notice: String?
    var input = ""
    private let access: AccountAccess
    private let gateway: any ProfileCityGateway
    private var generation = UUID()
    private var active = true
    private var closed = false
    private var inFlight = 0
    var live: Bool { !closed && active && access.isCurrent }
    var busy: Bool { inFlight > 0 || access.waitingForEarlierWork }
    var dirty: Bool { view != nil && input != (view?.city ?? "") }
    var canSave: Bool { live && !busy && (pending != nil || view != nil && dirty && ProfileCityWire.normalized(input) != nil && view?.revision != ProfileCityWire.maximumRevision) }
    var canRemove: Bool { live && !busy && pending == nil && view?.city != nil && view?.revision != ProfileCityWire.maximumRevision }
    init(access: AccountAccess, gateway: any ProfileCityGateway) { self.access = access; self.gateway = gateway }
    private func clear() { generation = UUID(); view = nil; input = ""; pending = nil; error = nil; notice = nil }
    func suspend() { active = false; clear() }
    func close() { closed = true; suspend() }
    func resume() async { guard !closed else { return }; active = true; await refresh() }
    private func retain(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if live && generation == ticket && access.owns(work) { return true }
        if generation == ticket { clear() }; return false
    }
    private func accept(_ result: ProfileCity) throws {
        try result.validate(uid: access.context.uid); view = result; input = result.city ?? ""; pending = nil; error = nil
    }
    func refresh() async {
        guard live, !busy, let work = access.begin() else { return }
        let ticket = generation; inFlight += 1; view = nil; input = ""; error = nil; notice = nil
        defer { inFlight -= 1; access.finish(work) }
        do {
            let result = try await gateway.profileCity(uid: access.context.uid)
            guard retain(ticket, work) else { return }; try accept(result)
        } catch { if retain(ticket, work) { self.error = "Impossible de charger la ville. Réessayez." } }
    }
    func save(removing: Bool = false) async {
        guard live, !busy else { return }
        let change: ProfileCityChange
        if let pending { change = pending }
        else {
            guard let view, removing ? canRemove : canSave else { return }
            let city = removing ? nil : ProfileCityWire.normalized(input)
            guard removing || city != nil, city != view.city else { return }
            change = .init(city: city, expectedRevision: view.revision, requestId: UUID())
        }
        do { try change.validate() } catch { return }
        guard let work = access.begin() else { return }
        let ticket = generation; inFlight += 1; pending = change; view = nil; error = nil; notice = nil
        defer { inFlight -= 1; access.finish(work) }
        do {
            let result = try await gateway.saveProfileCity(uid: access.context.uid, change: change)
            guard retain(ticket, work) else { return }
            try result.validate(uid: access.context.uid)
            try ProfileCityWire.require(result.revision == change.expectedRevision + 1 && result.city == change.city)
            try accept(result); notice = result.city == nil ? "Ville supprimée." : "Ville enregistrée."
        } catch {
            if retain(ticket, work) { self.error = "Enregistrement non confirmé. Réessayez ou actualisez la ville." }
        }
    }
}
