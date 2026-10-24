import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func getImpactSummary() async throws -> ImpactSummary {
        guard let uid = Auth.auth().currentUser?.uid else { return .empty }
        return try LedgerSummaryWire.impact(await ledgerPayload("getImpactSummary", uid: uid), uid: uid)
    }
    func getRewardSummary() async throws -> RewardSummary {
        guard let uid = Auth.auth().currentUser?.uid else { return .empty }
        return try LedgerSummaryWire.rewards(await ledgerPayload("getRewardSummary", uid: uid), uid: uid)
    }
    private func ledgerPayload(_ name: String, uid: String) async throws -> Any {
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        let payload: Any = try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable(name).call([:]) { result, error in
                if let error { continuation.resume(throwing: error) }
                else if let result { continuation.resume(returning: result.data) }
                else { continuation.resume(throwing: LedgerSummaryError.invalid) }
            }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        return payload
    }
}
#endif
