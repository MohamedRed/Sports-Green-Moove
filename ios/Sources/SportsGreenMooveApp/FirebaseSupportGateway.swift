import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    private func supportCall<Response: Sendable>(
        uid: String, name: String, input: [String: String],
        decode: @escaping @Sendable (Any) throws -> Response
    ) async throws -> Response {
        try await firebaseOwnedCall(uid: uid, name: name, input: input) { value in
            guard let value else { throw ProviderConfigurationError(message: "Réponse du support manquante.") }
            return try decode(value)
        }
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
