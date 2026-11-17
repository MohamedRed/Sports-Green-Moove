import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

func firebaseOwnedCall<Response: Sendable>(
    uid: String, name: String, input: [String: String],
    decode: @escaping @Sendable (Any?) throws -> Response
) async throws -> Response {
    try Task.checkCancellation()
    guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
    let response: Response = try await withCheckedThrowingContinuation { continuation in
        Functions.functions().httpsCallable(name).call(input) { result, error in
            if let error { continuation.resume(throwing: error) }
            else { continuation.resume(with: Result { try decode(result?.data) }) }
        }
    }
    try Task.checkCancellation()
    guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
    return response
}
#endif
