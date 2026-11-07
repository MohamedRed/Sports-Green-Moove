import Foundation

struct ChildAccountTarget: Equatable, Sendable {
    let childId: String
    let clubId: String
    let childInstanceId: String
    let childName: String

    init(view: EmergencyContactView) throws {
        guard case let .managed(.child(childId, clubId)) = view.scope,
              let instance = view.childInstanceId, let name = view.childName else { throw ChildAccountError.invalidResponse }
        try EmergencyContactWire.validate(view, uid: view.ownerUid, scope: view.scope)
        self.childId = childId; self.clubId = clubId; childInstanceId = instance; childName = name
    }
}

enum ChildAccountPresentation: Identifiable {
    case child(UUID)
    case parent(UUID, ChildAccountTarget)

    var id: UUID {
        switch self { case .child(let id), .parent(let id, _): id }
    }
    var target: ChildAccountTarget? {
        switch self { case .child: nil; case .parent(_, let target): target }
    }
    @MainActor init(access: AccountAccess, view: EmergencyContactView?) throws {
        guard access.isCurrent else { throw ChildAccountError.invalidResponse }
        if let view {
            guard access.context.role == .parent, !access.context.grantedRoles.contains(.child),
                view.ownerUid == access.context.uid else { throw ChildAccountError.invalidResponse }
            self = .parent(UUID(), try ChildAccountTarget(view: view))
        } else {
            guard access.context.role == .child, access.context.grantedRoles == [.child] else { throw ChildAccountError.invalidResponse }
            self = .child(UUID())
        }
    }
}

struct ChildAccountCode: Equatable, Sendable {
    let accountUserId: String
    let code: String
    let expiresAtMillis: Int64
}

struct ChildAccountReceipt: Equatable, Sendable {
    let accountUserId: String
    let childId: String
    let childInstanceId: String
    let replayed: Bool
}

enum ChildInvitationStatus: String, Sendable { case pending, provisioning, accepted, revoked }
struct ChildInvitationSummary: Equatable, Sendable {
    let invitationHash: String
    let status: ChildInvitationStatus
    let expiresAtMillis: Int64
}
struct ChildInvitationLink: Equatable, Sendable {
    let target: ChildAccountTarget
    let url: URL
    let current: ChildInvitationSummary
}

protocol ChildAccountGateway: Sendable {
    func childAccountCode(uid: String) async throws -> ChildAccountCode
    func approveChildAccount(uid: String, target: ChildAccountTarget, code: String) async throws -> ChildAccountReceipt
    func childInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationSummary?
    func createChildInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationLink
    func revokeChildInvitation(uid: String, target: ChildAccountTarget, hash: String) async throws
}

enum ChildAccountError: Error { case invalidResponse, unavailable }
