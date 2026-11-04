import Foundation
import Observation

enum AuthenticationFailure: Error { case storage }
enum AuthenticationCopy {
    static let failed = "Connexion impossible. Réessayez."
    static let cleanup = "Déconnexion incomplète. Réessayez."
}
enum AuthenticationResult: Sendable {
    case applied(UUID, AuthSession?)
    case failed(UUID, String)
    case signedOut(UUID)
    case ignored
}

@Observable @MainActor
final class AuthenticationState {
    private(set) var cleanupRequired = false
    private var pending: UUID?
    private var revision = UUID()
    private let makeStore: @MainActor () throws -> any LogoutIntentStore
    private var storage: (any LogoutIntentStore)?
    var busy: Bool { pending != nil || cleanupRequired }
    var finishingSignOut: Bool { pending.map { $0 != revision } ?? cleanupRequired }

    init(makeStore: @escaping @MainActor () throws -> any LogoutIntentStore = FileLogoutIntentStore.platformStore) {
        self.makeStore = makeStore
    }

    func owns(_ id: UUID) -> Bool { revision == id }

    func signOut(using gateway: AuthGateway) -> Bool {
        revision = UUID()
        cleanupRequired = true
        var persisted = false
        var cleared = false
        do { try store().setRequiresSignOut(true); persisted = true } catch { }
        do { try gateway.signOut(); cleared = true } catch { }
        cleanupRequired = !(persisted && cleared)
        return !cleanupRequired
    }

    func perform(
        using gateway: AuthGateway,
        changesIdentity: Bool,
        onBegin: @MainActor () -> Void,
        action: @MainActor () async throws -> AuthSession?,
        apply: @MainActor (AuthSession?) -> Void
    ) async -> AuthenticationResult {
        guard !busy, !Task.isCancelled else { return .ignored }
        let id = UUID()
        revision = id; pending = id
        defer { if pending == id { pending = nil } }
        onBegin()
        let policy: any LogoutIntentStore
        do {
            policy = try store()
            if try policy.requiresSignOut() {
                try gateway.signOut()
                if !changesIdentity { apply(nil); return .applied(id, nil) }
            }
            if changesIdentity { try policy.setRequiresSignOut(true) }
        } catch {
            cleanupRequired = true
            do { try gateway.signOut() } catch { }
            return .failed(revision, AuthenticationCopy.cleanup)
        }

        let session: AuthSession?
        do { session = try await action() }
        catch {
            if changesIdentity {
                return clearAbandonedIdentity(using: gateway, policy: policy, currentFailure: owns(id) && !Task.isCancelled)
            }
            return owns(id) && !Task.isCancelled ? .failed(id, AuthenticationCopy.failed) : .ignored
        }
        guard owns(id), !Task.isCancelled else {
            if changesIdentity { return clearAbandonedIdentity(using: gateway, policy: policy, currentFailure: false) }
            return .ignored
        }
        guard (!changesIdentity || session != nil), session?.uid.isEmpty != true else {
            return changesIdentity ? clearAbandonedIdentity(using: gateway, policy: policy, currentFailure: true) :
                .failed(id, AuthenticationCopy.failed)
        }
        do {
            if changesIdentity { try policy.setRequiresSignOut(false) }
        } catch {
            _ = clearAbandonedIdentity(using: gateway, policy: policy, currentFailure: false)
            cleanupRequired = true
            return .failed(revision, AuthenticationCopy.cleanup)
        }
        apply(session)
        return .applied(id, session)
    }

    private func clearAbandonedIdentity(
        using gateway: AuthGateway, policy: any LogoutIntentStore, currentFailure: Bool
    ) -> AuthenticationResult {
        if !currentFailure { revision = UUID() }
        var persisted = false
        var cleared = false
        do { try policy.setRequiresSignOut(true); persisted = true } catch { }
        do { try gateway.signOut(); cleared = true } catch { }
        cleanupRequired = !(persisted && cleared)
        if cleanupRequired { return .failed(revision, AuthenticationCopy.cleanup) }
        return currentFailure ? .failed(revision, AuthenticationCopy.failed) : .signedOut(revision)
    }

    private func store() throws -> any LogoutIntentStore {
        if let storage { return storage }
        let value = try makeStore(); storage = value; return value
    }
}
