import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFirestore

@MainActor final class FirebaseRideChatThreadWatch: RideChatWatch {
    let access: RideChatAccess
    let updates: AsyncThrowingStream<RideChatPage, any Error>
    private let continuation: AsyncThrowingStream<RideChatPage, any Error>.Continuation
    private var source: FirebaseRideChatSource?
    private var messages: (any ListenerRegistration)?
    private var identity: AuthStateDidChangeListenerHandle?
    private let clock = RideChatCallbackClock()
    private var latest: Int64 = 0
    private var closed = false
    private var sourceConfirmed = false
    var isCurrent: Bool {
        !closed && sourceConfirmed && Auth.auth().currentUser?.uid.utf8.elementsEqual(access.uid.value.utf8) == true
    }
    init(access: RideChatAccess) {
        self.access = access
        (updates, continuation) = AsyncThrowingStream.makeStream(bufferingPolicy: .bufferingNewest(1))
        continuation.onTermination = { [weak self] _ in Task { @MainActor [weak self] in self?.close() } }
        let uid = access.uid
        identity = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            let subject = user?.uid
            Task { @MainActor [weak self] in
                guard let self, !self.closed else { return }
                do { try RideChatWire.require(subject.map { $0.utf8.elementsEqual(uid.value.utf8) } == true) }
                catch { self.finish(RideChatError.accessRejected) }
            }
        }
        source = FirebaseRideChatSource(uid: uid, reference: access.reference) { [weak self] result in
            guard let self, !self.closed else { return }
            do {
                if try result.get() == Set(self.access.participants.keys) { self.sourceConfirmed = true; self.listen() }
                else { self.finish(RideChatError.accessRejected) }
            }
            catch { self.finish(error) }
        }
    }
    private func listen() {
        guard !closed, messages == nil else { return }
        let uid = access.uid, reference = access.reference, clock = clock
        messages = rideChatQuery(uid: uid, reference: reference).addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, error in
            do {
                let serial = try clock.next()
                let result: Result<RideChatPage?, any Error> = Result {
                    if let error { throw error }
                    guard let snapshot else { throw RideChatError.invalidResponse }
                    if snapshot.metadata.isFromCache { return nil }
                    return try rideChatPage(snapshot, uid: uid, reference: reference)
                }
                Task { @MainActor [weak self] in self?.accept(result, serial: serial) }
            } catch { Task { @MainActor [weak self] in self?.finish(error) } }
        }
    }
    private func accept(_ result: Result<RideChatPage?, any Error>, serial: Int64) {
        guard !closed, serial > latest else { return }; latest = serial
        do { try requireRideChatIdentity(access.uid); if let page = try result.get() { continuation.yield(page) } }
        catch { finish(error) }
    }
    private func finish(_ error: any Error) { guard !closed else { return }; continuation.finish(throwing: error); close() }
    func close() {
        guard !closed else { return }; closed = true; sourceConfirmed = false
        source?.close(); source = nil; messages?.remove(); messages = nil
        if let identity { Auth.auth().removeStateDidChangeListener(identity) }; identity = nil
        continuation.finish()
    }
}
#endif
