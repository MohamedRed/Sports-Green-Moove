import Foundation

actor ProfileInitializationProbe {
    private(set) var names: [String?] = []
    private var pending: [Int: CheckedContinuation<AuthSession, Error>] = [:]
    private var observers: [(Int, CheckedContinuation<Void, Never>)] = []

    func prepare(_ identity: AuthIdentity, displayName: String?) async throws -> AuthSession {
        names.append(displayName)
        let ordinal = names.count
        return try await withCheckedThrowingContinuation { continuation in
            pending[ordinal] = continuation
            let ready = observers.filter { $0.0 <= ordinal }
            observers.removeAll { $0.0 <= ordinal }
            for (_, observer) in ready { observer.resume() }
        }
    }

    func waitForCall(_ count: Int) async {
        if names.count >= count { return }
        await withCheckedContinuation { observers.append((count, $0)) }
    }

    func complete(_ ordinal: Int, uid: String = "isolated-profile", roles: [AppRole] = [.parent], fails: Bool = false) {
        guard let continuation = pending.removeValue(forKey: ordinal) else {
            preconditionFailure("Profile checkpoint was not pending")
        }
        if fails { continuation.resume(throwing: AuthenticationFailure.storage) }
        else { continuation.resume(returning: AuthSession(uid: uid, email: "qa@example.invalid",
            displayName: "Isolated parent", roles: roles)) }
    }
}
