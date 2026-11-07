import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions) && canImport(FirebaseFirestore)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    @MainActor
    func initializeProfile(identity: AuthIdentity, displayName: String?) async throws -> AuthSession {
        try Task.checkCancellation()
        guard let user = Auth.auth().currentUser, user.uid == identity.uid else { throw CancellationError() }
        let input = displayName.map { ["displayName": $0] } ?? [:]
        let session = try await firebaseOwnedCall(uid: identity.uid, name: "initializeUserProfile", input: input) {
            try InitializedProfileWire.session(expectedUid: identity.uid, payload: $0)
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == identity.uid else { throw CancellationError() }
        let roles: [AppRole] = try await withCheckedThrowingContinuation { continuation in
            user.getIDTokenResult(forcingRefresh: true) { result, error in
                if let error { continuation.resume(throwing: error) }
                else {
                    continuation.resume(with: Result { try InitializedProfileWire.roleKeys(result?.claims["roleKeys"]) })
                }
            }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == identity.uid, Set(roles) == Set(session.roles) else {
            throw CancellationError()
        }
        return session
    }
}
#endif
