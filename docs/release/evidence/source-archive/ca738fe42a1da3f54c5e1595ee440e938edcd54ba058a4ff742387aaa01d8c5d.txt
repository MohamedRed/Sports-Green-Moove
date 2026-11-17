import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
func uploadNativeLocationUpdate(_ update: NativeLocationBatchUpdate, uid: String) async throws {
    let updatesJson = try update.callableBatchJson()
    let _: Bool = try await firebaseOwnedCall(uid: uid, name: "writeLocationBatch", input: ["updatesJson": updatesJson]) { data in
        guard let payload = data as? [String: Any], let written = payload["written"] as? Int, written > 0 else {
            throw ProviderConfigurationError(message: "Réponse localisation invalide.")
        }
        return true
    }
}
#endif
