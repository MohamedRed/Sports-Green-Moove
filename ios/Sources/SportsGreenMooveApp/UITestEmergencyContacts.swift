import Foundation

#if DEBUG
actor UITestEmergencyContacts: EmergencyContactGateway {
    func guardianContacts(uid: String, cursor: String?) async throws -> GuardianContactPage {
        guard uid == "ui-user", cursor == nil || cursor == "fixture_contacts_page_2" else { throw EmergencyContactError.unavailable }
        if cursor == nil {
            return GuardianContactPage(items: (1...20).map {
                GuardianContactRecord(id: String(format: "%064x", $0), parentUserId: uid, childId: "old-child-\($0)", clubId: "old-club",
                    childName: "Ancien profil", clubName: "Club de démonstration", status: .refused, revision: 1, allowedActions: ["request"])
            }, nextCursor: "fixture_contacts_page_2")
        }
        return GuardianContactPage(items: [GuardianContactRecord(id: String(format: "%064x", 21), parentUserId: uid,
            childId: "child-1", clubId: "club-royal", childName: "Nora", clubName: "Royal Ottignies Sports",
            status: .verified, revision: 2, allowedActions: ["withdraw"])], nextCursor: nil)
    }
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
        if case let .child(childId, clubId) = target {
            result.childId = childId; result.childInstanceId = String(repeating: "a", count: 64)
            result.childName = childId == "child-1" ? "Nora" : "Enfant de démonstration"
            result.clubName = clubId == "club-royal" ? "Royal Ottignies Sports" : "Club de démonstration"
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
    func guardianContacts(uid: String, cursor: String?) async throws -> GuardianContactPage {
        try await emergencyFixture.guardianContacts(uid: uid, cursor: cursor)
    }
    func emergencyContact(uid: String, scope: EmergencyContactScope) async throws -> EmergencyContactView? {
        try await emergencyFixture.emergencyContact(uid: uid, scope: scope)
    }
    func saveEmergencyContact(uid: String, operation: EmergencyContactOperation) async throws -> Int64 {
        try await emergencyFixture.saveEmergencyContact(uid: uid, operation: operation)
    }
}
#endif
