import Foundation

actor GuardianContactProbe: EmergencyContactGateway {
    var pages: [String: GuardianContactPage]
    private var calls: [String?] = []
    private var held: Set<Int> = []
    private var pending: [Int: CheckedContinuation<Void, Error>] = [:]
    private var observers: [Int: CheckedContinuation<Void, Never>] = [:]
    init(pages: [String: GuardianContactPage]) { self.pages = pages }
    func configure(_ pages: [String: GuardianContactPage]) { self.pages = pages }
    func count() -> Int { calls.count }
    func cursors() -> [String?] { calls }
    func holdNext() -> Int { let id = calls.count + 1; held.insert(id); return id }
    func waitForCall(_ id: Int) async { if pending[id] == nil { await withCheckedContinuation { observers[id] = $0 } } }
    func release(_ id: Int, failing: Bool) {
        guard let continuation = pending.removeValue(forKey: id) else { fatalError("Missing controlled guardian contact boundary") }
        if failing { continuation.resume(throwing: EmergencyContactError.unavailable) } else { continuation.resume() }
    }
    func guardianContacts(uid: String, cursor: String?) async throws -> GuardianContactPage {
        let page = pages[cursor ?? "first"]
        calls.append(cursor); let id = calls.count
        if held.remove(id) != nil {
            try await withCheckedThrowingContinuation { continuation in
                pending[id] = continuation; observers.removeValue(forKey: id)?.resume()
            }
        }
        guard let page else { throw EmergencyContactError.unavailable }
        return page
    }
    func emergencyContact(uid: String, scope: EmergencyContactScope) async throws -> EmergencyContactView? { throw EmergencyContactError.unavailable }
    func saveEmergencyContact(uid: String, operation: EmergencyContactOperation) async throws -> Int64 { throw EmergencyContactError.unavailable }
}

func isolatedGuardianContact(_ index: Int, uid: String = "isolated-parent", status: GuardianContactStatus = .verified,
    childName: String? = "Enfant fictif", clubId: String = "isolated-club") -> GuardianContactRecord {
    GuardianContactRecord(id: String(format: "%064x", index), parentUserId: uid, childId: "isolated-child-\(index)",
        clubId: clubId, childName: childName, clubName: "Club fictif", status: status, revision: 1,
        allowedActions: [status == .verified || status == .requested ? "withdraw" : "request"])
}
