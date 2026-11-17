import Foundation

#if DEBUG
actor UITestEmergencyContacts: EmergencyContactGateway {
    private var contacts: [EmergencyContactTarget: PersonalEmergencyContact] = [:]
    private var revisions: [EmergencyContactTarget: Int64] = [:]
    func emergencyContact(uid: String, scope: EmergencyContactScope) async throws -> EmergencyContactView? {
        if case let .childRide(id) = scope {
            guard uid == "ui-child-login", id == nil || id == "fixture-child-ride" else { throw EmergencyContactError.unavailable }
            return EmergencyContactView(ownerUid: uid, scope: .childRide("fixture-child-ride"),
                contact: PersonalEmergencyContact(name: "Contact fictif", phone: "+32470000001"), revision: 1,
                childId: "profile-not-login", childInstanceId: String(repeating: "a", count: 64), childName: "Enfant Démo")
        }
        guard case let .managed(target) = scope else { throw EmergencyContactError.unavailable }
        var result = EmergencyContactView(ownerUid: uid, scope: scope, contact: contacts[target], revision: revisions[target] ?? 0)
        if case let .child(childId, _) = target {
            result.childId = childId; result.childInstanceId = String(repeating: "a", count: 64)
            result.childName = "Enfant de démonstration"; result.clubName = "Club de démonstration"
        }
        return result
    }
    func saveEmergencyContact(uid: String, operation: EmergencyContactOperation) async throws -> Int64 {
        _ = try EmergencyContactWire.payload(operation)
        guard operation.expectedRevision == (revisions[operation.target] ?? 0) else { throw EmergencyContactError.invalidInput }
        contacts[operation.target] = operation.contact
        let revision = operation.expectedRevision + 1; revisions[operation.target] = revision
        return revision
    }
}

extension UITestFirebaseGateway {
    func emergencyContact(uid: String, scope: EmergencyContactScope) async throws -> EmergencyContactView? {
        try await emergencyFixture.emergencyContact(uid: uid, scope: scope)
    }
    func saveEmergencyContact(uid: String, operation: EmergencyContactOperation) async throws -> Int64 {
        try await emergencyFixture.saveEmergencyContact(uid: uid, operation: operation)
    }
}
#endif
