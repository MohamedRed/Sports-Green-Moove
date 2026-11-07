import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func getImpactSummary() async throws -> ImpactSummary {
        guard let uid = Auth.auth().currentUser?.uid else { return .empty }
        return try await firebaseOwnedCall(uid: uid, name: "getImpactSummary", input: [:]) { value in
            guard let value else { throw LedgerSummaryError.invalid }
            return try LedgerSummaryWire.impact(value, uid: uid)
        }
    }
    func getRewardSummary() async throws -> RewardSummary {
        guard let uid = Auth.auth().currentUser?.uid else { return .empty }
        return try await firebaseOwnedCall(uid: uid, name: "getRewardSummary", input: [:]) { value in
            guard let value else { throw LedgerSummaryError.invalid }
            return try LedgerSummaryWire.rewards(value, uid: uid)
        }
    }
}
#endif
