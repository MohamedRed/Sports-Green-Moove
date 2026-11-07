import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func requestMembership(uid: String, clubId: String) async throws -> MembershipReceipt {
        try await membershipCall(uid: uid, request: .request(clubId)) { try MembershipWire.receipt($0, uid: uid, clubId: clubId) }
    }
    func membershipReviewClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipChoice> {
        try await membershipCall(uid: uid, request: .clubs(cursor)) { try MembershipWire.choices($0, uid: uid) }
    }
    func membershipReviews(uid: String, clubId: String, cursor: String?) async throws -> MembershipPage<MembershipReview> {
        try await membershipCall(uid: uid, request: .members(clubId, cursor)) { try MembershipWire.reviews($0, uid: uid, clubId: clubId) }
    }
    func decideMembership(uid: String, row: MembershipReview, decision: MembershipDecision) async throws -> MembershipDecisionReceipt {
        try await membershipCall(uid: uid, request: .decide(row, decision)) { try MembershipWire.decision($0, row: row, decision: decision) }
    }
    private func membershipCall<Value: Sendable>(uid: String, request: MembershipRequest,
        decode: @escaping @Sendable (Any?) throws -> Value) async throws -> Value {
        try requireMembershipIdentity(uid)
        let result: Value = try await withCheckedThrowingContinuation { continuation in
            do {
                let input = try request.payload()
                Functions.functions().httpsCallable(request.name).call(input) { result, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(with: Result { try decode(result?.data) }) }
                }
            } catch { continuation.resume(throwing: error) }
        }
        try requireMembershipIdentity(uid); return result
    }
}
#endif
