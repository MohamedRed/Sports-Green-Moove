import Foundation

actor EmergencyContactProbe: EmergencyContactGateway {
    func guardianContacts(uid: String, cursor: String?) async throws -> GuardianContactPage { throw EmergencyContactError.unavailable }
    var value: EmergencyContactView?
    private var calls: [String] = []
    private var suspended: Set<Int> = []
    private var pending: [Int: CheckedContinuation<Void, Error>] = [:]
    private var observers: [Int: CheckedContinuation<Void, Never>] = [:]
    private(set) var operations: [EmergencyContactOperation] = []
    var loseWriteReply = false

    init(value: EmergencyContactView?) { self.value = value }
    func configure(_ value: EmergencyContactView?) { self.value = value }
    func loseNextWriteReply() { loseWriteReply = true }
    func holdNext() -> Int { let id = calls.count + 1; suspended.insert(id); return id }
    func names() -> [String] { calls }
    func waitForCall(_ id: Int) async {
        if pending[id] != nil { return }
        await withCheckedContinuation { observers[id] = $0 }
    }
    func release(_ id: Int, failing: Bool) {
        guard let next = pending.removeValue(forKey: id) else { fatalError("Missing controlled contact boundary") }
        if failing { next.resume(throwing: EmergencyContactError.unavailable) } else { next.resume() }
    }
    private func step(_ name: String) async throws {
        calls.append(name); let id = calls.count
        if suspended.remove(id) != nil {
            try await withCheckedThrowingContinuation { continuation in
                pending[id] = continuation; observers.removeValue(forKey: id)?.resume()
            }
        }
    }
    func emergencyContact(uid: String, scope: EmergencyContactScope) async throws -> EmergencyContactView? {
        let result = value
        try await step("read")
        return result
    }
    func saveEmergencyContact(uid: String, operation: EmergencyContactOperation) async throws -> Int64 {
        operations.append(operation)
        try await step("save")
        guard let value, value.revision == operation.expectedRevision else { throw EmergencyContactError.invalidInput }
        self.value = EmergencyContactView(ownerUid: uid, scope: .managed(operation.target), contact: operation.contact,
            revision: value.revision + 1, childId: value.childId, childInstanceId: value.childInstanceId,
            childName: value.childName, clubName: value.clubName)
        if loseWriteReply { loseWriteReply = false; throw EmergencyContactError.unavailable }
        return value.revision + 1
    }
}

@MainActor final class EmergencyPhoneProbe: EmergencyPhoneOpening {
    var result = EmergencyPhoneResult.opened
    var contacts: [PersonalEmergencyContact] = []
    var hold = false
    private var pending: CheckedContinuation<Void, Never>?
    private var observer: CheckedContinuation<Void, Never>?
    func open(_ contact: PersonalEmergencyContact) async -> EmergencyPhoneResult {
        contacts.append(contact)
        if hold { await withCheckedContinuation { pending = $0; observer?.resume(); observer = nil } }
        return result
    }
    func waitForOpen() async { if pending == nil { await withCheckedContinuation { observer = $0 } } }
    func release() { pending?.resume(); pending = nil }
}

@MainActor func emergencyAccess(uid: String = "isolated-parent", roles: [AppRole] = [.parent, .driver]) -> (AccountWorkScope, AccountAccess) {
    let scope = AccountWorkScope()
    scope.replace(session: AuthSession(uid: uid, email: nil, displayName: nil, roles: roles), role: roles[0])
    return (scope, scope.access!)
}

func isolatedEmergencyView(uid: String = "isolated-parent", contact: PersonalEmergencyContact? = nil, revision: Int64 = 0) -> EmergencyContactView {
    EmergencyContactView(ownerUid: uid, scope: .managed(.personal), contact: contact, revision: revision)
}
let isolatedContact = PersonalEmergencyContact(name: "Contact fictif", phone: "+32470000001")
