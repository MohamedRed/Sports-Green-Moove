import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func receivedRatings(uid: String) async throws -> ReceivedRatingSummary {
        try Task.checkCancellation()
        guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        let response: ReceivedRatingSummary = try await withCheckedThrowingContinuation { continuation in
            let input: [String: String] = [:]
            Functions.functions().httpsCallable("getReceivedRatingSummary").call(input) { result, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(with: Result { try ReceivedRatingsWire.parse(result?.data, uid: uid) }) }
            }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }; return response
    }
}
#endif

extension UnconfiguredFirebaseGateway {
    func receivedRatings(uid: String) async throws -> ReceivedRatingSummary {
        throw ProviderConfigurationError(message: "Les avis reçus ne sont pas configurés.")
    }
}

#if DEBUG
extension UITestFirebaseGateway {
    func receivedRatings(uid: String) async throws -> ReceivedRatingSummary {
        guard uid == "ui-user" else { throw CancellationError() }
        return .init(userId: uid, count: 2, average: 4.5)
    }
}
#endif
