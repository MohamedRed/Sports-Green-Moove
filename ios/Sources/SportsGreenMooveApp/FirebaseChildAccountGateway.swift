import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
extension FirebaseBackendGateway {
    func childAccountCode(uid: String) async throws -> ChildAccountCode {
        try await firebaseOwnedCall(uid: uid, name: "createChildAccountLinkCode", input: [:]) { try ChildAccountWire.code($0, uid: uid) }
    }
    func approveChildAccount(uid: String, target: ChildAccountTarget, code: String) async throws -> ChildAccountReceipt {
        try ChildAccountWire.require(ChildAccountWire.hex(code, count: 32))
        var payload = try ChildAccountWire.target(target); payload["code"] = code
        return try await firebaseOwnedCall(uid: uid, name: "approveChildAccountLink", input: payload) {
            try ChildAccountWire.receipt($0, uid: uid, target: target)
        }
    }
    func childInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationSummary? {
        try await firebaseOwnedCall(uid: uid, name: "getChildInvitation", input: ChildAccountWire.target(target)) { try ChildAccountWire.current($0) }
    }
    func createChildInvitation(uid: String, target: ChildAccountTarget) async throws -> ChildInvitationLink {
        try await firebaseOwnedCall(uid: uid, name: "createChildInvitation", input: ChildAccountWire.target(target)) {
            try ChildInvitationWire.link($0, target: target, now: Int64(Date().timeIntervalSince1970 * 1000))
        }
    }
    func revokeChildInvitation(uid: String, target: ChildAccountTarget, hash: String) async throws {
        try ChildAccountWire.require(ChildAccountWire.hex(hash, count: 64))
        var payload = try ChildAccountWire.target(target); payload["invitationHash"] = hash
        let _: Bool = try await firebaseOwnedCall(uid: uid, name: "revokeChildInvitation", input: payload) { raw in
            try ChildAccountWire.revocation(raw, hash: hash)
            return true
        }
    }
}
#endif
