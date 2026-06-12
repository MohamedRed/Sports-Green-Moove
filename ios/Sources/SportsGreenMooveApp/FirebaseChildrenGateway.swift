import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFirestore)
import FirebaseAuth
import FirebaseFirestore

extension FirebaseBackendGateway {
    func listChildren() async throws -> [ChildSummary] {
        guard let uid = Auth.auth().currentUser?.uid else { return [] }
        let snapshot = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[QueryDocumentSnapshot], Error>) in
            Firestore.firestore()
                .collection("children")
                .whereField("guardianUserIds", arrayContains: uid)
                .limit(to: 20)
                .getDocuments { snapshot, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else if let snapshot {
                        continuation.resume(returning: snapshot.documents)
                    } else {
                        continuation.resume(throwing: ProviderConfigurationError(message: "Réponse enfants invalide."))
                    }
                }
        }

        return snapshot.map { mapChild(id: $0.documentID, data: $0.data()) }
    }
}

private func mapChild(id: String, data: [String: Any]) -> ChildSummary {
    ChildSummary(
        id: id,
        label: stringValue(data["displayName"]) ?? stringValue(data["name"]) ?? stringValue(data["firstName"]) ?? "Enfant \(id.suffix(4).uppercased())",
        teamLabel: stringValue(data["teamName"]) ?? stringValue(data["category"]) ?? stringValue(data["clubName"]) ?? "Équipe à confirmer",
        trackingEnabled: data["trackingConsent"] as? Bool == true || data["trackingEnabled"] as? Bool == true
    )
}

private func stringValue(_ value: Any?) -> String? {
    guard let value = value as? String else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}
#endif
