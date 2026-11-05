import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func profileCity(uid: String) async throws -> ProfileCity { try await cityCall(uid: uid, request: .read) }
    func saveProfileCity(uid: String, change: ProfileCityChange) async throws -> ProfileCity {
        try await cityCall(uid: uid, request: .save(change))
    }
    private func cityCall(uid: String, request: ProfileCityRequest) async throws -> ProfileCity {
        try Task.checkCancellation()
        guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        let result: ProfileCity = try await withCheckedThrowingContinuation { continuation in
            do {
                let input = try request.payload()
                Functions.functions().httpsCallable(request.name).call(input) { result, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(with: Result { try ProfileCityWire.parse(result?.data, uid: uid) }) }
                }
            } catch { continuation.resume(throwing: error) }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }; return result
    }
}
#endif

extension UnconfiguredFirebaseGateway {
    func profileCity(uid: String) async throws -> ProfileCity {
        throw ProviderConfigurationError(message: "La ville du profil n’est pas configurée.")
    }
    func saveProfileCity(uid: String, change: ProfileCityChange) async throws -> ProfileCity {
        throw ProviderConfigurationError(message: "La ville du profil n’est pas configurée.")
    }
}
