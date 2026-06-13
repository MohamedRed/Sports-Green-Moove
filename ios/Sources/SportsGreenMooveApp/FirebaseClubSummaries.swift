import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFirestore)
import FirebaseAuth
import FirebaseFirestore

func loadClubSummaries() async throws -> [ClubSummary] {
    let roles = try await loadMembershipRoles()
    let snapshot = try await queryDocuments(
        Firestore.firestore()
            .collection("clubs")
            .order(by: "name")
            .limit(to: 50)
    )

    return snapshot.map { document in
        mapClubSummary(id: document.documentID, data: document.data(), role: roles[document.documentID])
    }
}

private func loadMembershipRoles() async throws -> [String: String] {
    guard let uid = Auth.auth().currentUser?.uid else { return [:] }
    let snapshot = try await queryDocuments(
        Firestore.firestore()
            .collection("memberships")
            .whereField("userId", isEqualTo: uid)
            .limit(to: 50)
    )

    return snapshot.compactMap { document in
        let data = document.data()
        guard let clubId = data["clubId"] as? String else { return nil }
        let role = (data["role"] as? String)?.uppercased(with: Locale(identifier: "fr_BE")) ?? "MEMBRE"
        return (clubId, role)
    }.reduce(into: [:]) { roles, item in
        roles[item.0] = item.1
    }
}

private func mapClubSummary(id: String, data: [String: Any], role: String?) -> ClubSummary {
    let name = data["name"] as? String ?? data["displayName"] as? String ?? id
    return ClubSummary(
        id: id,
        name: name,
        sport: data["sport"] as? String ?? data["primarySport"] as? String ?? "Sport",
        memberCount: intValue(data["memberCount"]) ?? intValue(data["members"]) ?? 0,
        roleLabel: role,
        initials: initials(name),
        memberInitials: data["memberInitials"] as? [String] ?? []
    )
}

private func queryDocuments(_ query: Query) async throws -> [QueryDocumentSnapshot] {
    try await withCheckedThrowingContinuation { continuation in
        query.getDocuments { snapshot, error in
            if let error {
                continuation.resume(throwing: error)
            } else if let snapshot {
                continuation.resume(returning: snapshot.documents)
            } else {
                continuation.resume(throwing: ProviderConfigurationError(message: "Réponse clubs invalide."))
            }
        }
    }
}

private func initials(_ value: String) -> String {
    let parts = value.split(separator: " ").prefix(2)
    let result = parts.compactMap(\.first).map { String($0).uppercased() }.joined()
    return result.isEmpty ? "CL" : result
}

private func intValue(_ value: Any?) -> Int? {
    if let int = value as? Int { return int }
    if let number = value as? NSNumber { return number.intValue }
    return nil
}
#endif
