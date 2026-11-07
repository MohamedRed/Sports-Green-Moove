import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFirestore)
import FirebaseAuth
import FirebaseFirestore

func loadClubSummaries() async throws -> [ClubSummary] {
    guard let uid = Auth.auth().currentUser?.uid else { throw CancellationError() }
    let memberships = try await loadClubMemberships(uid: uid)
    let snapshot = try await queryDocuments(
        Firestore.firestore()
            .collection("clubs")
            .order(by: "name")
            .limit(to: 50)
    )

    try Task.checkCancellation()
    guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
    return snapshot.map { document in
        mapClubSummary(id: document.documentID, data: document.data(), member: memberships[document.documentID])
    }
}

private func loadClubMemberships(uid: String) async throws -> [String: ClubMembership] {
    let snapshot = try await queryDocuments(
        Firestore.firestore()
            .collection("memberships")
            .whereField("userId", isEqualTo: uid)
            .limit(to: 50)
    )

    try Task.checkCancellation()
    guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
    var members: [String: ClubMembership] = [:]
    for document in snapshot {
        let data = document.data()
        let clubId = try MembershipWire.identifier(data["clubId"])
        try MembershipWire.require(members[clubId] == nil)
        members[clubId] = try MembershipWire.member(data, documentId: document.documentID, uid: uid, clubId: clubId)
    }
    return members
}

private func mapClubSummary(id: String, data: [String: Any], member: ClubMembership?) -> ClubSummary {
    let name = data["name"] as? String ?? data["displayName"] as? String ?? id
    return ClubSummary(
        id: id,
        name: name,
        sport: data["sport"] as? String ?? data["primarySport"] as? String ?? "Sport",
        memberCount: intValue(data["memberCount"]) ?? intValue(data["members"]) ?? 0,
        roleLabel: member?.isActive == true ? member?.role.uppercased(with: Locale(identifier: "fr_BE")) : nil,
        initials: initials(name),
        memberInitials: data["memberInitials"] as? [String] ?? [],
        membershipStatus: member?.status, membershipActive: member?.active
    )
}

private func queryDocuments(_ query: Query) async throws -> [QueryDocumentSnapshot] {
    try await withCheckedThrowingContinuation { continuation in
        query.getDocuments(source: .server) { snapshot, error in
            if let error {
                continuation.resume(throwing: error)
            } else if let snapshot, !snapshot.metadata.isFromCache && !snapshot.metadata.hasPendingWrites {
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
