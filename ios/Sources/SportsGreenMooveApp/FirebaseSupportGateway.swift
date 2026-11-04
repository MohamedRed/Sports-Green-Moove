import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    private func supportCall<Response: Sendable>(
        uid: String, name: String, input: [String: String],
        decode: @escaping @Sendable (Any) throws -> Response
    ) async throws -> Response {
        guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        let result: Response = try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable(name).call(input) { result, error in
                if let error { continuation.resume(throwing: error) }
                else if let data = result?.data {
                    continuation.resume(with: Result { try decode(data) })
                }
                else { continuation.resume(throwing: ProviderConfigurationError(message: "Réponse du support manquante.")) }
            }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        return result
    }
    func supportReports(uid: String, cursor: String?) async throws -> SupportPage<SupportReport> {
        try SupportWire.require(SupportWire.validCursor(cursor))
        return try await supportCall(uid: uid, name: "listMySupportReports", input: cursor.map { ["cursor": $0] } ?? [:]) {
            try SupportWire.reports($0)
        }
    }
    func supportReport(uid: String, reportId: String, cursor: String?) async throws -> SupportDetail {
        try SupportWire.require(SupportWire.validCursor(cursor) && !reportId.isEmpty && !reportId.contains("/"))
        var input = ["reportId": reportId]; if let cursor { input["cursor"] = cursor }
        return try await supportCall(uid: uid, name: "getMySupportReport", input: input) {
            try SupportWire.detail($0, reportId: reportId)
        }
    }
}
#endif
