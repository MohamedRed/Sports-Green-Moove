import Foundation
import CryptoKit

func isolatedChildTarget() throws -> ChildAccountTarget {
    try ChildAccountTarget(view: EmergencyContactView(ownerUid: "isolated-parent", scope: .managed(.child(childId: "child-profile", clubId: "club")),
        contact: nil, revision: 0, childId: "child-profile", childInstanceId: String(repeating: "a", count: 64), childName: "Enfant fictif", clubName: "Club fictif"))
}
let isolatedChildNow: Int64 = 1_800_000_000_000
let isolatedChildCode = String(repeating: "c", count: 32)
func isolatedChildLink(_ target: ChildAccountTarget) -> ChildInvitationLink {
    let token = String(repeating: "b", count: 64)
    let hash = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
    return ChildInvitationLink(target: target, url: URL(string: "https://sports-green-moove-prod.web.app/child-invitation#" + token)!,
        current: ChildInvitationSummary(invitationHash: hash, status: .pending, expiresAtMillis: isolatedChildNow + 86_400_000))
}
actor ChildAccountProbe: ChildAccountGateway {
    private(set) var calls: [String] = []
    private var held: Int?
    private var pending: CheckedContinuation<Void, Error>?
    private var observer: CheckedContinuation<Void, Never>?
    var invitation: ChildInvitationSummary?
    var foreign = false
    var loseCreateReply = false
    func configure(_ status: ChildInvitationSummary? = nil, foreign: Bool = false, loseCreateReply: Bool = false) {
        invitation = status; self.foreign = foreign; self.loseCreateReply = loseCreateReply
    }
    func holdNext() { held = calls.count + 1 }
    func waitForCall() async { if pending == nil { await withCheckedContinuation { observer = $0 } } }
    func release(failing: Bool) {
        guard let continuation = pending else { fatalError("No suspended child-account operation") }
        pending = nil
        if failing { continuation.resume(throwing: ChildAccountError.unavailable) } else { continuation.resume() }
    }
    private func step(_ name: String) async throws {
        calls.append(name)
        if held == calls.count {
            held = nil
            try await withCheckedThrowingContinuation { pending = $0; observer?.resume(); observer = nil }
        }
    }
    func childAccountCode(uid: String) async throws -> ChildAccountCode {
        try await step("code")
        return ChildAccountCode(accountUserId: foreign ? "foreign" : uid, code: isolatedChildCode, expiresAtMillis: isolatedChildNow + 600_000)
    }
    func approveChildAccount(uid: String, target: ChildAccountTarget, code: String) async throws -> ChildAccountReceipt {
        try await step("approve")
        try ChildAccountWire.require(code == isolatedChildCode)
        return ChildAccountReceipt(accountUserId: foreign ? uid : "child-login", childId: target.childId, childInstanceId: target.childInstanceId, replayed: false)
    }
    func childInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationSummary? {
        try await step("current"); return invitation
    }
    func createChildInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationLink {
        try await step("create")
        let link = isolatedChildLink(target); invitation = link.current
        if loseCreateReply { loseCreateReply = false; throw ChildAccountError.unavailable }
        return link
    }
    func revokeChildInvitation(uid: String, target: ChildAccountTarget, hash: String) async throws {
        try await step("revoke")
        guard let invitation, invitation.invitationHash == hash else { throw ChildAccountError.invalidResponse }
        self.invitation = ChildInvitationSummary(invitationHash: hash, status: .revoked, expiresAtMillis: invitation.expiresAtMillis)
    }
}
