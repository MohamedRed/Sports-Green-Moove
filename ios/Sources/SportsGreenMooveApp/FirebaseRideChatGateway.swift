import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions

extension FirebaseBackendGateway {
    func rideChatDirectory(uid: RideChatID, cursor: String?) async throws -> RideChatDirectoryPage {
        try await rideChatCall(uid: uid, request: .directory(cursor: cursor)) { try RideChatDirectoryWire.directory($0, uid: uid) }
    }
    func rideChatBookings(uid: RideChatID, cursor: String?) async throws -> RideChatBookingPage {
        try await rideChatCall(uid: uid, request: .bookings(cursor: cursor)) { try RideChatDirectoryWire.bookings($0, uid: uid) }
    }
    private func rideChatAccess(uid: RideChatID, reference: RideChatReference) async throws -> RideChatAccess {
        try await rideChatCall(uid: uid, request: .access(reference)) { try RideChatWire.access($0, uid: uid, reference: reference) }
    }
    @MainActor func openRideChat(uid: RideChatID, reference: RideChatReference) async throws -> any RideChatWatch {
        let access = try await rideChatAccess(uid: uid, reference: reference)
        try requireRideChatIdentity(uid)
        return FirebaseRideChatThreadWatch(access: access)
    }
    @MainActor func observeRideChatInbox(uid: RideChatID) throws -> any RideChatInboxWatch {
        try requireRideChatIdentity(uid); return FirebaseRideChatInboxWatch(uid: uid)
    }
    func earlierRideChat(uid: RideChatID, reference: RideChatReference, cursor: RideChatPosition) async throws -> RideChatPage {
        _ = try await rideChatAccess(uid: uid, reference: reference)
        try requireRideChatIdentity(uid)
        let query = rideChatQuery(uid: uid, reference: reference)
            .start(after: [Timestamp(seconds: cursor.seconds, nanoseconds: cursor.nanos), cursor.id.value])
        let page: RideChatPage = try await withCheckedThrowingContinuation { continuation in
            query.getDocuments(source: .server) { snapshot, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(with: Result { try rideChatPage(snapshot, uid: uid, reference: reference, after: cursor) }) }
            }
        }
        try requireRideChatIdentity(uid); return page
    }
    func sendRideChat(uid: RideChatID, reference: RideChatReference, body: String, requestId: UUID) async throws -> RideChatReceipt {
        do {
            return try await rideChatCall(uid: uid, request: .send(reference, body: body, requestId: requestId)) {
                try RideChatMessageWire.sent($0, uid: uid, reference: reference, request: requestId)
            }
        } catch { if await rideChatRejected(error) { throw RideChatError.sendRejected }; throw error }
    }
    func readRideChat(uid: RideChatID, reference: RideChatReference, ids: [RideChatID]) async throws -> RideChatReadReceipt {
        do {
            return try await rideChatCall(uid: uid, request: .read(reference, ids: ids)) {
                try RideChatMessageWire.reads($0, uid: uid, reference: reference, ids: ids)
            }
        } catch {
            if error is RideChatError { throw RideChatError.accessRejected }
            if await rideChatRejected(error) { throw RideChatError.accessRejected }; throw error
        }
    }
    private func rideChatCall<Response: Sendable>(uid: RideChatID, request: RideChatRequest,
        decode: @escaping @Sendable (Any?) throws -> Response) async throws -> Response {
        try requireRideChatIdentity(uid)
        let value: Response = try await withCheckedThrowingContinuation { continuation in
            do {
                let input = try request.payload()
                Functions.functions().httpsCallable(request.name).call(input) { result, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(with: Result { try decode(result?.data) }) }
                }
            } catch { continuation.resume(throwing: error) }
        }
        try requireRideChatIdentity(uid); return value
    }
}
@MainActor private func rideChatRejected(_ error: any Error) -> Bool {
    let value = error as NSError
    return value.domain == FunctionsErrorDomain && [FunctionsErrorCode.invalidArgument, .permissionDenied,
        .unauthenticated, .notFound, .failedPrecondition, .alreadyExists].contains { $0.rawValue == value.code }
}
#endif
