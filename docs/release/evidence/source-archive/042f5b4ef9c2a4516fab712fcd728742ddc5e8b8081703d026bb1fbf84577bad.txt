import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func teamChatChoices(uid: String, clubId: String?, cursor: String?) async throws -> TeamChatChoices {
        try await teamCall(uid: uid, request: .choices(clubId: clubId, cursor: cursor)) {
            try TeamChatWire.choices($0, uid: uid, clubId: clubId)
        }
    }
    func teamChatMessages(uid: String, target: TeamChatTarget, cursor: String?) async throws -> TeamChatPage {
        try await teamCall(uid: uid, request: .messages(target, cursor: cursor)) { try TeamChatWire.page($0, uid: uid, target: target) }
    }
    func sendTeamChat(uid: String, target: TeamChatTarget, body: String, requestId: UUID) async throws -> String {
        do {
            return try await teamCall(uid: uid, request: .send(target, body: body, requestId: requestId)) {
                try TeamChatWire.receipt($0, uid: uid, target: target, requestId: requestId)
            }
        } catch {
            if await teamRejected(error) { throw TeamChatError.sendRejected }; throw error
        }
    }
    func readTeamChat(uid: String, target: TeamChatTarget, accessVersion: String, ids: [String]) async throws {
        do {
            try await teamCall(uid: uid, request: .read(target, accessVersion: accessVersion, ids: ids)) {
                try TeamChatWire.reads($0, uid: uid, target: target, version: accessVersion, ids: ids)
            }
        } catch {
            if error is TeamChatError { throw TeamChatError.accessRejected }
            if await teamRejected(error) { throw TeamChatError.accessRejected }; throw error
        }
    }
    private func teamCall<Response: Sendable>(uid: String, request: TeamChatRequest,
        decode: @escaping @Sendable (Any?) throws -> Response) async throws -> Response {
        try Task.checkCancellation()
        guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        let response: Response = try await withCheckedThrowingContinuation { continuation in
            do {
                let input = try request.payload()
                Functions.functions().httpsCallable(request.name).call(input) { result, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(with: Result { try decode(result?.data) }) }
                }
            } catch { continuation.resume(throwing: error) }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }; return response
    }
    @MainActor private func teamRejected(_ error: any Error) -> Bool {
        let error = error as NSError
        return error.domain == FunctionsErrorDomain && [FunctionsErrorCode.invalidArgument, .permissionDenied,
            .unauthenticated, .notFound, .failedPrecondition, .alreadyExists].contains { $0.rawValue == error.code }
    }
}
#endif
