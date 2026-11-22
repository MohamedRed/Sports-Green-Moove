import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseFunctions) && canImport(FirebaseAuth)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            var data: [String: Any] = [
                "rideSessionId": rideSessionId,
                "ratedUserId": ratedUserId,
                "score": score,
            ]
            if let comment, !comment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                data["comment"] = comment
            }
            Functions.functions().httpsCallable("submitRating").call(data) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any],
                          let ratingId = payload["ratingId"] as? String {
                    continuation.resume(returning: ratingId)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse avis invalide."))
                }
            }
        }
    }

    func createReport(submission: SupportSubmission) async throws -> String {
        guard submission.isValid, Auth.auth().currentUser?.uid == submission.uid else { throw SupportSubmissionError.account }
        let id: String = try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable("submitSupportReport").call(submission.payload) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data {
                    do { continuation.resume(returning: try submission.acknowledgedReport(payload)) }
                    catch { continuation.resume(throwing: error) }
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse signalement invalide."))
                }
            }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == submission.uid else { throw SupportSubmissionError.account }
        return id
    }
}
#endif
