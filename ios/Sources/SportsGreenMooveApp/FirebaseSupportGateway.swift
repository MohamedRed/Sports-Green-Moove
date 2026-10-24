import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    private func supportCall(uid: String, name: String, input: [String: Any]) async throws -> Any {
        guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        let result: Any = try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable(name).call(input) { result, error in
                if let error { continuation.resume(throwing: error) }
                else if let data = result?.data { continuation.resume(returning: data) }
                else { continuation.resume(throwing: ProviderConfigurationError(message: "Réponse du support manquante.")) }
            }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        return result
    }
    func supportReports(uid: String, cursor: String?) async throws -> SupportPage<SupportReport> {
        try SupportWire.require(SupportWire.validCursor(cursor))
        return try SupportWire.reports(await supportCall(uid: uid, name: "listMySupportReports", input: cursor.map { ["cursor": $0] } ?? [:]))
    }
    func supportReport(uid: String, reportId: String, cursor: String?) async throws -> SupportDetail {
        try SupportWire.require(SupportWire.validCursor(cursor) && !reportId.isEmpty && !reportId.contains("/"))
        var input = ["reportId": reportId]; if let cursor { input["cursor"] = cursor }
        return try SupportWire.detail(await supportCall(uid: uid, name: "getMySupportReport", input: input), reportId: reportId)
    }
}
#endif
