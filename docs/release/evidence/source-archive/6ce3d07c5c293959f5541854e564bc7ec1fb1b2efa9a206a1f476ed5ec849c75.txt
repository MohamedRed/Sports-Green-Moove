import Foundation
import CryptoKit

#if DEBUG
actor UITestChildAccounts: ChildAccountGateway {
    private var invitation: ChildInvitationSummary?
    private let code = String(repeating: "c", count: 32)
    private func parent(_ uid: String, _ target: ChildAccountTarget) throws {
        try ChildAccountWire.require(uid == "ui-user" && target.childId == "child-1" && target.clubId == "club-royal" && target.childInstanceId == String(repeating: "a", count: 64))
    }
    func childAccountCode(uid: String) async throws -> ChildAccountCode {
        try ChildAccountWire.require(uid == "ui-child-login")
        return ChildAccountCode(accountUserId: uid, code: code, expiresAtMillis: Int64(Date().timeIntervalSince1970 * 1000) + 600_000)
    }
    func approveChildAccount(uid: String, target: ChildAccountTarget, code: String) async throws -> ChildAccountReceipt {
        try parent(uid, target); try ChildAccountWire.require(code == self.code)
        return ChildAccountReceipt(accountUserId: "ui-child-login", childId: target.childId, childInstanceId: target.childInstanceId, replayed: false)
    }
    func childInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationSummary? { try parent(uid, target); return invitation }
    func createChildInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationLink {
        try parent(uid, target)
        let token = String(repeating: "b", count: 64)
        let hash = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        let current = ChildInvitationSummary(invitationHash: hash, status: .pending, expiresAtMillis: Int64(Date().timeIntervalSince1970 * 1000) + 86_400_000)
        invitation = current
        return ChildInvitationLink(target: target, url: URL(string: "https://sports-green-moove-prod.web.app/child-invitation#" + token)!, current: current)
    }
    func revokeChildInvitation(uid: String, target: ChildAccountTarget, hash: String) async throws {
        try parent(uid, target)
        guard let invitation, invitation.invitationHash == hash, invitation.status == .pending else { throw ChildAccountError.invalidResponse }
        self.invitation = ChildInvitationSummary(invitationHash: hash, status: .revoked, expiresAtMillis: invitation.expiresAtMillis)
    }
}
extension UITestFirebaseGateway {
    func childAccountCode(uid: String) async throws -> ChildAccountCode { try await childAccountsFixture.childAccountCode(uid: uid) }
    func approveChildAccount(uid: String, target: ChildAccountTarget, code: String) async throws -> ChildAccountReceipt {
        try await childAccountsFixture.approveChildAccount(uid: uid, target: target, code: code)
    }
    func childInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationSummary? {
        try await childAccountsFixture.childInvitation(uid: uid, target: target)
    }
    func createChildInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationLink {
        try await childAccountsFixture.createChildInvitation(uid: uid, target: target)
    }
    func revokeChildInvitation(uid: String, target: ChildAccountTarget, hash: String) async throws {
        try await childAccountsFixture.revokeChildInvitation(uid: uid, target: target, hash: hash)
    }
}
#endif
