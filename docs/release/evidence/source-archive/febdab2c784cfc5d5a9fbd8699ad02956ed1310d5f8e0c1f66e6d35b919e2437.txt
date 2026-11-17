import Foundation
import Observation

@MainActor @Observable final class EmergencyContactState {
    private(set) var view: EmergencyContactView?
    private(set) var loaded = false
    private(set) var busy = false
    private(set) var error: String?
    private(set) var notice: String?
    private(set) var pending: EmergencyContactOperation?
    var name = ""
    var phone = ""
    let scope: EmergencyContactScope
    private let access: AccountAccess
    private let gateway: any EmergencyContactGateway
    private var generation = UUID()
    private var foreground = true
    private var closed = false

    init(access: AccountAccess, scope: EmergencyContactScope, gateway: any EmergencyContactGateway) {
        self.access = access; self.scope = scope; self.gateway = gateway
    }
    var canEdit: Bool { live && allowedScope && !scope.readOnly && !access.context.grantedRoles.contains(.child) }
    var canDial: Bool { live && !busy && pending == nil && !dirty && view?.contact != nil }
    var accountIsCurrent: Bool { live }
    var dirty: Bool { canEdit && view != nil && (name != (view?.contact?.name ?? "") || phone != (view?.contact?.phone ?? "")) }
    var canSave: Bool { canEdit && !busy && pending == nil && dirty && PersonalEmergencyContact(name: name, phone: phone).isValid }
    private var live: Bool { !closed && foreground && access.isCurrent }

    func suspend() { foreground = false; invalidate() }
    func close() { closed = true; suspend() }
    func resume() async { guard !closed else { return }; foreground = true; await refresh() }
    private func invalidate() {
        generation = UUID(); view = nil; loaded = false; busy = false; pending = nil
        name = ""; phone = ""; error = nil; notice = nil
    }
    private func current(_ ticket: UUID, _ work: AccountWork) -> Bool { live && generation == ticket && access.owns(work) }
    private func retainCurrent(_ ticket: UUID, _ work: AccountWork) -> Bool {
        if current(ticket, work) { return true }
        if generation == ticket { invalidate() }
        return false
    }
    private var allowedScope: Bool {
        if access.context.grantedRoles.contains(.child) { return scope.readOnly }
        switch scope {
        case .managed(.personal): return access.context.grantedRoles.contains { [.parent, .driver, .clubManager].contains($0) }
        case .managed(.child): return access.context.role == .parent
        case .childRide: return false
        }
    }
    private func accept(_ next: EmergencyContactView?) throws {
        if let next { try EmergencyContactWire.validate(next, uid: access.context.uid, scope: scope) }
        else if !scope.readOnly { throw EmergencyContactError.invalidResponse }
        view = next; loaded = true; name = next?.contact?.name ?? ""; phone = next?.contact?.phone ?? ""
    }
    func refresh() async {
        guard live, !busy, pending == nil, allowedScope, let work = access.begin() else { return }
        invalidate(); let ticket = generation; busy = true
        defer { access.finish(work); if generation == ticket { busy = false } }
        do {
            let next = try await gateway.emergencyContact(uid: access.context.uid, scope: scope)
            try access.requireCurrent(work); guard retainCurrent(ticket, work) else { return }
            try accept(next)
        } catch {
            guard retainCurrent(ticket, work) else { return }
            view = nil; loaded = false; self.error = "Contact indisponible. Actualisez pour réessayer."
        }
    }
    func reviewSave(removing: Bool = false) {
        guard canEdit, !busy, pending == nil, let view, case let .managed(target) = scope else { return }
        let contact = removing ? nil : PersonalEmergencyContact(name: name, phone: phone)
        guard removing ? view.contact != nil : canSave else { return }
        let operation = EmergencyContactOperation(target: target, contact: contact, expectedRevision: view.revision,
            requestId: UUID(), expectedChildInstanceId: view.childInstanceId)
        do { _ = try EmergencyContactWire.payload(operation); pending = operation }
        catch { self.error = "Vérifiez le nom et le numéro international du contact." }
    }
    func cancelReview() { pending = nil }
    func discardEdits() {
        guard live, !busy, pending == nil, let view else { return }
        name = view.contact?.name ?? ""; phone = view.contact?.phone ?? ""
    }
    func confirmSave() async {
        guard live, !busy, allowedScope, let operation = pending, let work = access.begin() else { return }
        let ticket = generation; pending = nil; busy = true; view = nil; loaded = false; error = nil; notice = nil
        defer { access.finish(work); if generation == ticket { busy = false } }
        do {
            let version = try await gateway.saveEmergencyContact(uid: access.context.uid, operation: operation)
            try access.requireCurrent(work); guard retainCurrent(ticket, work) else { return }
            try EmergencyContactWire.require(version > operation.expectedRevision && version <= EmergencyContactWire.maximumRevision)
            let latest = try await gateway.emergencyContact(uid: access.context.uid, scope: scope)
            try access.requireCurrent(work); guard retainCurrent(ticket, work) else { return }
            guard let latest else { throw EmergencyContactError.invalidResponse }
            try EmergencyContactWire.require(latest.revision >= version)
            if case .child = operation.target { try EmergencyContactWire.require(latest.childInstanceId == operation.expectedChildInstanceId) }
            try accept(latest)
            notice = latest.revision == version && latest.contact == operation.contact ? "Contact enregistré." : "Le contact a été modifié depuis. Vérifiez-le."
        } catch {
            guard retainCurrent(ticket, work) else { return }
            view = nil; loaded = false
            self.error = "Enregistrement non confirmé. Actualisez avant toute nouvelle modification."
        }
    }
    func dial(using opener: any EmergencyPhoneOpening) async {
        guard canDial, allowedScope, let expected = view, let work = access.begin() else { return }
        let ticket = generation; busy = true; view = nil; error = nil; notice = nil
        defer { access.finish(work); if generation == ticket { busy = false } }
        do {
            let latest = try await gateway.emergencyContact(uid: access.context.uid, scope: expected.scope)
            try access.requireCurrent(work); guard retainCurrent(ticket, work) else { return }
            try accept(latest)
            guard latest == expected, let contact = latest?.contact else {
                notice = "Le contact a changé. Vérifiez-le avant d’ouvrir Téléphone."; return
            }
            let result = await opener.open(contact)
            guard retainCurrent(ticket, work) else { return }
            switch result {
            case .opened: notice = "Ouverture de Téléphone demandée."
            case .unavailable: error = "Impossible d’ouvrir Téléphone sur cet appareil."
            }
        } catch {
            guard retainCurrent(ticket, work) else { return }
            view = nil; loaded = false; name = ""; phone = ""
            self.error = "Impossible de vérifier le contact. Actualisez."
        }
    }
}
