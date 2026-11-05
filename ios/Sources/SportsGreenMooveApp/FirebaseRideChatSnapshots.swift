import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFirestore

func requireRideChatIdentity(_ uid: RideChatID) throws {
    try Task.checkCancellation()
    guard let current = Auth.auth().currentUser?.uid, try RideChatID(current) == uid else { throw RideChatError.accessRejected }
}
func rideChatQuery(uid: RideChatID, reference: RideChatReference) -> Query {
    Firestore.firestore().collection("messages").whereField("participantUserIds", arrayContains: uid.value)
        .whereField("sourceType", isEqualTo: reference.kind.rawValue).whereField("sourceId", isEqualTo: reference.sourceId.value)
        .order(by: "createdAt", descending: true).order(by: FieldPath.documentID(), descending: true).limit(to: 51)
}
func rideChatPage(_ snapshot: QuerySnapshot?, uid: RideChatID, reference: RideChatReference,
    after: RideChatPosition? = nil) throws -> RideChatPage {
    guard let snapshot, !snapshot.metadata.isFromCache, !snapshot.metadata.hasPendingWrites else { throw RideChatError.invalidResponse }
    let rows = try snapshot.documents.map { row in
        let data = row.data()
        guard let at = data["createdAt"] as? Timestamp else { throw RideChatError.invalidResponse }
        let position = try RideChatPosition(seconds: at.seconds, nanos: at.nanoseconds, id: RideChatID(row.documentID))
        return try RideChatMessageWire.message(data, position: position, uid: uid, reference: reference)
    }
    return try RideChatMessageWire.page(rows, uid: uid, reference: reference, after: after)
}
@MainActor func rideChatSourceDenied(_ error: any Error) -> Bool {
    let value = error as NSError
    return value.domain == FirestoreErrorDomain && [FirestoreErrorCode.permissionDenied, .notFound].contains { $0.rawValue == value.code }
}

@MainActor final class FirebaseRideChatSource {
    private let uid: RideChatID
    private let reference: RideChatReference
    private let receive: @MainActor (Result<Set<RideChatID>, any Error>) -> Void
    private let clock = RideChatCallbackClock()
    private var latest: Int64 = 0
    private var registration: (any ListenerRegistration)?
    private var closed = false
    init(uid: RideChatID, reference: RideChatReference, receive: @escaping @MainActor (Result<Set<RideChatID>, any Error>) -> Void) {
        self.uid = uid; self.reference = reference; self.receive = receive
        let clock = clock
        registration = Firestore.firestore().collection(reference.sourceCollection).document(reference.sourceId.value)
            .addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, error in
                do {
                    let serial = try clock.next()
                    let result: Result<Set<RideChatID>?, any Error> = Result {
                        if let error { throw error }
                        guard let snapshot else { throw RideChatError.invalidResponse }
                        if snapshot.metadata.isFromCache { return nil }
                        try RideChatWire.require(!snapshot.metadata.hasPendingWrites && RideChatID(snapshot.documentID) == reference.sourceId)
                        return try RideChatSourcePolicy.participants(snapshot.exists ? snapshot.data() : nil, reference: reference)
                    }
                    Task { @MainActor [weak self] in self?.accept(result, serial: serial) }
                } catch { Task { @MainActor [weak self] in self?.fail(error) } }
            }
    }
    private func accept(_ result: Result<Set<RideChatID>?, any Error>, serial: Int64) {
        guard !closed, serial > latest else { return }; latest = serial
        do {
            try requireRideChatIdentity(uid)
            if let participants = try result.get() { receive(.success(participants)) }
        } catch {
            if rideChatSourceDenied(error) { receive(.success([])) }
            else { fail(error) }
        }
    }
    private func fail(_ error: any Error) { if !closed { receive(.failure(error)) } }
    func close() { guard !closed else { return }; closed = true; registration?.remove(); registration = nil }
}
#endif
