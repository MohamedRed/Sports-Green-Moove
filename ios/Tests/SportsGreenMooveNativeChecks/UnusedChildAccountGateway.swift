import Foundation

extension AppDataFixtureGateway {
    func childAccountCode(uid: String) async throws -> ChildAccountCode { throw ChildAccountError.unavailable }
    func approveChildAccount(uid: String, target: ChildAccountTarget, code: String) async throws -> ChildAccountReceipt { throw ChildAccountError.unavailable }
    func childInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationSummary? { throw ChildAccountError.unavailable }
    func createChildInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationLink { throw ChildAccountError.unavailable }
    func revokeChildInvitation(uid: String, target: ChildAccountTarget, hash: String) async throws { throw ChildAccountError.unavailable }
}
