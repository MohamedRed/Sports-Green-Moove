import Foundation

@MainActor
final class MemoryLogoutIntentStore: LogoutIntentStore {
    var required = false
    var failRead = false
    var failWrite = false
    var writes: [Bool] = []
    func requiresSignOut() throws -> Bool {
        if failRead { throw AuthenticationFailure.storage }
        return required
    }
    func setRequiresSignOut(_ value: Bool) throws {
        if failWrite { throw AuthenticationFailure.storage }
        required = value; writes.append(value)
    }
}

@MainActor
final class AuthenticationProbe: AuthGateway {
    nonisolated let isConfigured = true
    private(set) var providerUid: String?
    private(set) var calls: [String] = []
    private(set) var signOutCalls = 0
    var failSignOut = false
    private var pending: [Int: (Bool, CheckedContinuation<AuthIdentity?, Error>)] = [:]
    private var observers: [(Int, CheckedContinuation<Void, Never>)] = []

    init(providerUid: String? = nil) { self.providerUid = providerUid }

    func currentSession() async throws -> AuthIdentity? { try await request("restore", mutates: false) }
    func signIn(email: String, password: String) async throws -> AuthIdentity { try await identity("signIn") }
    func signUp(name: String, email: String, password: String) async throws -> AuthIdentity { try await identity("signUp") }
    func signInWithGoogle() async throws -> AuthIdentity { try await identity("google") }
    func signInWithFacebook() async throws -> AuthIdentity { try await identity("facebook") }
    func signOut() throws {
        signOutCalls += 1
        if failSignOut { throw AuthenticationFailure.storage }
        providerUid = nil
    }

    func waitForCall(_ count: Int) async {
        if calls.count >= count { return }
        await withCheckedContinuation { observers.append((count, $0)) }
    }

    func complete(_ ordinal: Int, uid: String?, fails: Bool = false) {
        guard let (mutates, continuation) = pending.removeValue(forKey: ordinal) else {
            preconditionFailure("Authentication checkpoint was not pending")
        }
        if mutates { providerUid = uid }
        if fails { continuation.resume(throwing: AuthenticationFailure.storage) }
        else { continuation.resume(returning: uid.map { AuthIdentity(uid: $0, email: nil) }) }
    }

    private func identity(_ name: String) async throws -> AuthIdentity {
        guard let session = try await request(name, mutates: true) else { throw AuthenticationFailure.storage }
        return session
    }

    private func request(_ name: String, mutates: Bool) async throws -> AuthIdentity? {
        calls.append(name)
        let ordinal = calls.count
        return try await withCheckedThrowingContinuation { continuation in
            pending[ordinal] = (mutates, continuation)
            let ready = observers.filter { $0.0 <= calls.count }
            observers.removeAll { $0.0 <= calls.count }
            for (_, observer) in ready { observer.resume() }
        }
    }
}
