import Foundation

actor ProfileCityProbe: ProfileCityGateway {
    private var value = ProfileCity(userId: "parent", city: nil, revision: 0)
    private var reply: ProfileCity?
    private var last: ProfileCityChange?
    private var failure = false
    private var suspended = false
    private var pending: CheckedContinuation<Void, Error>?
    private var arrival: CheckedContinuation<Void, Never>?
    private var watchdog: Task<Void, Never>?
    private(set) var calls: [String] = []
    private(set) var changes: [ProfileCityChange] = []
    func configure(reply: ProfileCity? = nil, failure: Bool = false, suspended: Bool = false) {
        self.reply = reply; self.failure = failure; self.suspended = suspended
    }
    func profileCity(uid: String) async throws -> ProfileCity {
        let result = reply ?? value; try await dispatch("read:" + uid); return result
    }
    func saveProfileCity(uid: String, change: ProfileCityChange) async throws -> ProfileCity {
        changes.append(change)
        if change != last {
            try ProfileCityWire.require(change.expectedRevision == value.revision)
            last = change; value = .init(userId: uid, city: change.city, revision: change.expectedRevision + 1)
        }
        let result = reply ?? value; try await dispatch("save:" + uid); return result
    }
    private func dispatch(_ name: String) async throws {
        let shouldFail = failure; calls.append(name); watchdog?.cancel(); arrival?.resume(); arrival = nil
        if suspended { suspended = false; try await withCheckedThrowingContinuation { pending = $0 } }
        if shouldFail { throw ProfileCityError.invalidResponse }
    }
    func waitForCall(after count: Int) async {
        if calls.count > count { return }
        await withCheckedContinuation { continuation in
            arrival = continuation
            watchdog = Task { [weak self] in
                do { try await Task.sleep(for: .seconds(10)) } catch { return }
                await self?.requireArrival()
            }
        }
    }
    private func requireArrival() { precondition(arrival == nil, "Isolated city call never started") }
    func release(failing: Bool) {
        if failing { pending?.resume(throwing: ProfileCityError.invalidResponse) } else { pending?.resume() }
        pending = nil
    }
}

extension AppDataFixtureGateway {
    func profileCity(uid: String) async throws -> ProfileCity { try await UnconfiguredFirebaseGateway().profileCity(uid: uid) }
    func saveProfileCity(uid: String, change: ProfileCityChange) async throws -> ProfileCity {
        try await UnconfiguredFirebaseGateway().saveProfileCity(uid: uid, change: change)
    }
}
