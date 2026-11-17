import Foundation

@MainActor
final class LocationSessionState {
    private var owner: (id: UUID, ride: String)?
    private var pendingStarts: Set<UUID> = []
    private var pendingUploads: Set<UUID> = []
    private var idleWaiters: [CheckedContinuation<Void, Never>] = []
    var hasPendingWork: Bool { !pendingStarts.isEmpty || !pendingUploads.isEmpty }

    func begin(ride: String) throws -> UUID {
        try Task.checkCancellation()
        guard !ride.isEmpty else { throw ProviderConfigurationError(message: "Course indisponible.") }
        guard owner == nil, pendingStarts.isEmpty, pendingUploads.isEmpty else {
            throw ProviderConfigurationError(message: "Une demande de suivi est déjà en cours.")
        }
        let id = UUID()
        owner = (id, ride); pendingStarts.insert(id)
        return id
    }

    func requireCurrent(_ id: UUID) throws {
        try Task.checkCancellation()
        guard owns(id) else { throw CancellationError() }
    }

    func owns(_ id: UUID) -> Bool { owner?.id == id }
    func finishStart(_ id: UUID) { pendingStarts.remove(id); notifyIdle() }

    func beginUpload(_ ownerId: UUID) throws -> UUID {
        try requireCurrent(ownerId)
        let id = UUID(); pendingUploads.insert(id); return id
    }

    func finishUpload(_ id: UUID) { pendingUploads.remove(id); notifyIdle() }

    func waitUntilIdle() async {
        guard hasPendingWork else { return }
        await withCheckedContinuation { idleWaiters.append($0) }
    }

    private func notifyIdle() {
        guard !hasPendingWork else { return }
        let completed = idleWaiters; idleWaiters.removeAll()
        for waiter in completed { waiter.resume() }
    }

    @discardableResult
    func revoke(ride: String? = nil) -> Bool {
        guard let owner, ride == nil || ride == owner.ride else { return false }
        self.owner = nil
        return true
    }
}
