import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func guardianContacts(uid: String, cursor: String?) async throws -> GuardianContactPage {
        try await contactCall(uid: uid, request: .guardianContacts(cursor: cursor)) {
            try GuardianContactWire.page($0, uid: uid)
        }
    }
    func emergencyContact(uid: String, scope: EmergencyContactScope) async throws -> EmergencyContactView? {
        try await contactCall(uid: uid, request: .read(scope)) {
            try EmergencyContactWire.view($0, uid: uid, scope: scope)
        }
    }
    func saveEmergencyContact(uid: String, operation: EmergencyContactOperation) async throws -> Int64 {
        try await contactCall(uid: uid, request: .save(operation)) {
            try EmergencyContactWire.receipt($0, uid: uid, operation: operation)
        }
    }
    private func contactCall<Response: Sendable>(uid: String, request: EmergencyContactRequest,
        decode: @escaping @Sendable (Any?) throws -> Response) async throws -> Response {
        try Task.checkCancellation()
        guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        let response: Response = try await withCheckedThrowingContinuation { continuation in
            do {
                let input = try request.payload()
                Functions.functions().httpsCallable(request.name).call(input) { result, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(with: Result { try decode(result?.data) }) }
                }
            } catch { continuation.resume(throwing: error) }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        return response
    }
}
#endif
