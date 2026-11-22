import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseFunctions) && canImport(FirebaseAuth)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func submitRating(uid: String, rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String {
        try Task.checkCancellation()
        guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        let id: String = try await withCheckedThrowingContinuation { continuation in
            var data: [String: Any] = ["rideSessionId": rideSessionId, "ratedUserId": ratedUserId, "score": score]
            if let comment, !comment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { data["comment"] = comment }
            Functions.functions().httpsCallable("submitRating").call(data) { result, error in
                if let error { continuation.resume(throwing: error) }
                else if let payload = result?.data as? [String: Any], let id = payload["ratingId"] as? String,
                        id == "\(rideSessionId)_\(uid)_\(ratedUserId)" { continuation.resume(returning: id) }
                else { continuation.resume(throwing: ProviderConfigurationError(message: "Réponse avis invalide.")) }
            }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        return id
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
