import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFirestore

@MainActor final class FirebaseRideChatInboxWatch: RideChatInboxWatch {
    let updates: AsyncThrowingStream<RideChatDirectorySignal, any Error>
    private let continuation: AsyncThrowingStream<RideChatDirectorySignal, any Error>.Continuation
    private let uid: RideChatID
    private var index: (any ListenerRegistration)?
    private var identity: AuthStateDidChangeListenerHandle?
    private var sources: [RideChatReference: FirebaseRideChatSource] = [:]
    private let clock = RideChatCallbackClock()
    private var latest: Int64 = 0
    private var closed = false
    var isCurrent: Bool { !closed && Auth.auth().currentUser?.uid.utf8.elementsEqual(uid.value.utf8) == true }
    init(uid: RideChatID) {
        self.uid = uid; (updates, continuation) = AsyncThrowingStream.makeStream()
        continuation.onTermination = { [weak self] _ in Task { @MainActor [weak self] in self?.close() } }
        identity = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            let subject = user?.uid
            Task { @MainActor [weak self] in
                guard let self, !self.closed else { return }
                if subject.map({ $0.utf8.elementsEqual(uid.value.utf8) }) != true { self.finish(RideChatError.accessRejected) }
            }
        }
        let clock = clock
        index = Firestore.firestore().collection("chatInboxes").whereField("userId", isEqualTo: uid.value)
            .order(by: "lastMessageAt", descending: true).order(by: FieldPath.documentID(), descending: true).limit(to: 21)
            .addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, error in
                do {
                    let serial = try clock.next()
                    let result: Result<Bool, any Error> = Result {
                        if let error { throw error }; guard let snapshot else { throw RideChatError.invalidResponse }
                        if snapshot.metadata.isFromCache { return false }
                        try RideChatWire.require(!snapshot.metadata.hasPendingWrites); return true
                    }
                    Task { @MainActor [weak self] in self?.accept(result, serial: serial) }
                } catch { Task { @MainActor [weak self] in self?.finish(error) } }
            }
    }
    func setReferences(_ references: Set<RideChatReference>) throws {
        try requireRideChatIdentity(uid); guard !closed else { throw RideChatError.accessRejected }
        for key in Array(sources.keys) where !references.contains(key) { sources.removeValue(forKey: key)?.close() }
        for reference in references where sources[reference] == nil {
            sources[reference] = FirebaseRideChatSource(uid: uid, reference: reference) { [weak self] result in
                guard let self, !self.closed, self.sources[reference] != nil else { return }
                do { self.continuation.yield(.source(reference, participants: try result.get())) }
                catch { self.finish(error) }
            }
        }
    }
    private func accept(_ result: Result<Bool, any Error>, serial: Int64) {
        guard !closed, serial > latest else { return }; latest = serial
        do { try requireRideChatIdentity(uid); if try result.get() { continuation.yield(.indexChanged) } }
        catch { finish(error) }
    }
    private func finish(_ error: any Error) { guard !closed else { return }; continuation.finish(throwing: error); close() }
    func close() {
        guard !closed else { return }; closed = true
        sources.values.forEach { $0.close() }; sources = [:]; index?.remove(); index = nil
        if let identity { Auth.auth().removeStateDidChangeListener(identity) }; identity = nil
        continuation.finish()
    }
}
#endif
