import Foundation

struct PersonalEmergencyContact: Equatable, Sendable {
    let name: String
    let phone: String
    var isValid: Bool {
        EmergencyContactWire.validText(name, maximum: 100) &&
        phone.range(of: #"^\+[1-9][0-9]{7,14}\z"#, options: .regularExpression) != nil
    }
}

enum EmergencyContactTarget: Equatable, Hashable, Sendable {
    case personal
    case child(childId: String, clubId: String)
}

enum EmergencyContactScope: Equatable, Hashable, Sendable {
    case managed(EmergencyContactTarget)
    case childRide(String?)
    var readOnly: Bool { if case .childRide = self { true } else { false } }
}

struct EmergencyContactView: Equatable, Sendable {
    let ownerUid: String
    let scope: EmergencyContactScope
    let contact: PersonalEmergencyContact?
    let revision: Int64
    var childId: String?
    var childInstanceId: String?
    var childName: String?
    var clubName: String?
}

struct EmergencyContactOperation: Equatable, Sendable {
    let target: EmergencyContactTarget
    let contact: PersonalEmergencyContact?
    let expectedRevision: Int64
    let requestId: UUID
    let expectedChildInstanceId: String?
}

protocol EmergencyContactGateway: Sendable {
    func guardianContacts(uid: String, cursor: String?) async throws -> GuardianContactPage
    func emergencyContact(uid: String, scope: EmergencyContactScope) async throws -> EmergencyContactView?
    func saveEmergencyContact(uid: String, operation: EmergencyContactOperation) async throws -> Int64
}

enum EmergencyPhoneResult: Sendable { case opened, unavailable }

@MainActor protocol EmergencyPhoneOpening: Sendable {
    func open(_ contact: PersonalEmergencyContact) async -> EmergencyPhoneResult
}

enum EmergencyContactError: Error { case invalidResponse, invalidInput, unavailable }
