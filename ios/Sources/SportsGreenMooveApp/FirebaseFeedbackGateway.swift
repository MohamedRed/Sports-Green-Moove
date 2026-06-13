import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseFunctions)
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

    func createReport(subjectType: String, subjectId: String?, reason: String, description: String, emergency: Bool) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            var data: [String: Any] = [
                "subjectType": subjectType,
                "reason": reason,
                "description": description,
                "emergency": emergency,
            ]
            if let subjectId, !subjectId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                data["subjectId"] = subjectId
            }
            Functions.functions().httpsCallable("createReport").call(data) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let payload = result?.data as? [String: Any],
                          let reportId = payload["reportId"] as? String {
                    continuation.resume(returning: reportId)
                } else {
                    continuation.resume(throwing: ProviderConfigurationError(message: "Réponse signalement invalide."))
                }
            }
        }
    }
}
#endif
