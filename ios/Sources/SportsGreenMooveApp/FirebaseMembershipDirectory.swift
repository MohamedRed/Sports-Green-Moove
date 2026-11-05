import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFirestore

extension FirebaseBackendGateway {
    func membershipClubs(uid: String, cursor: String?) async throws -> MembershipPage<MembershipClub> {
        try requireMembershipIdentity(uid)
        var query = Firestore.firestore().collection("clubs").order(by: FieldPath.documentID()).limit(to: 21)
        if let cursor { try MembershipWire.require(MembershipWire.id(cursor)); query = query.start(after: [cursor]) }
        let catalog = try await membershipCatalog(query)
        try requireMembershipIdentity(uid)
        try MembershipWire.require(catalog.count <= 21 && Set(catalog.map(\.id)).count == catalog.count)
        var result: [MembershipClub] = []
        for row in catalog.prefix(20) {
            try requireMembershipIdentity(uid)
            var row = row
            let membershipId = uid + "_" + row.id
            try MembershipWire.require(MembershipWire.id(membershipId))
            let member = try await membershipRecord(uid: uid, clubId: row.id, membershipId: membershipId)
            try requireMembershipIdentity(uid)
            row.membership = member
            result.append(row)
        }
        return .init(userId: uid, items: result, cursor: catalog.count > 20 ? result.last?.id : nil)
    }
}

private func membershipCatalog(_ query: Query) async throws -> [MembershipClub] {
    try await withCheckedThrowingContinuation { continuation in
        query.getDocuments(source: .server) { snapshot, error in
            if let error { continuation.resume(throwing: error); return }
            continuation.resume(with: Result {
                guard let snapshot, !snapshot.metadata.isFromCache, !snapshot.metadata.hasPendingWrites else { throw MembershipError.invalidResponse }
                return try snapshot.documents.map { try MembershipWire.club($0.documentID, data: $0.data()) }
            })
        }
    }
}
private func membershipRecord(uid: String, clubId: String, membershipId: String) async throws -> ClubMembership? {
    try await withCheckedThrowingContinuation { continuation in
        Firestore.firestore().collection("memberships").whereField("userId", isEqualTo: uid)
            .whereField("clubId", isEqualTo: clubId).limit(to: 2).getDocuments(source: .server) { snapshot, error in
            if let error { continuation.resume(throwing: error); return }
            continuation.resume(with: Result {
                guard let snapshot, !snapshot.metadata.isFromCache, !snapshot.metadata.hasPendingWrites else { throw MembershipError.invalidResponse }
                try MembershipWire.require(snapshot.documents.count <= 1)
                guard let document = snapshot.documents.first else { return nil }
                try MembershipWire.require(document.documentID == membershipId)
                return try MembershipWire.member(document.data(), documentId: document.documentID, uid: uid, clubId: clubId)
            })
        }
    }
}

func requireMembershipIdentity(_ uid: String) throws {
    try Task.checkCancellation()
    guard MembershipWire.id(uid), Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
}
#endif
