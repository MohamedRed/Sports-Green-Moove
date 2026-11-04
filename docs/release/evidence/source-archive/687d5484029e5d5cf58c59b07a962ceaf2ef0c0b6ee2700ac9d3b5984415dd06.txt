import Foundation

#if canImport(FirebaseFunctions)
import FirebaseFunctions

extension FirebaseBackendGateway {
    func createTrip(draft: TripPublishDraft) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable("createTrip").call(draft.callablePayload()) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any],
                          let tripId = payload["tripId"] as? String {
                    continuation.resume(returning: tripId)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse publication invalide."))
                }
            }
        }
    }
}
#endif
