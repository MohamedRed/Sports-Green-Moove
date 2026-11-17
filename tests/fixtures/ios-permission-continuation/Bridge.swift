import Foundation

@MainActor final class PermissionBridge {
    let manager = PermissionManager()
    private var authorizationContinuation: CheckedContinuation<Void, Error>?

/* ACTUAL_PERMISSION_BRIDGE */

    func start() async throws { try await requestAlwaysAuthorization() }
    func finish(authorized: Bool) {
        guard let continuation = authorizationContinuation else { fatalError("No pending permission") }
        authorizationContinuation = nil
        if authorized { continuation.resume(returning: ()) }
        else { continuation.resume(throwing: CancellationError()) }
    }
}

@MainActor final class PermissionManager {
    private(set) var requests = 0
    private var observers: [(Int, CheckedContinuation<Void, Never>)] = []
    func requestAlwaysAuthorization() {
        requests += 1
        let ready = observers.filter { $0.0 <= requests }
        observers.removeAll { $0.0 <= requests }
        for (_, observer) in ready { observer.resume() }
    }
    func waitForRequest(_ count: Int) async {
        if requests >= count { return }
        await withCheckedContinuation { observers.append((count, $0)) }
    }
}
