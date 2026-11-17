import Foundation

actor ReceivedRatingsProbe: ReceivedRatingsGateway {
    private var pending: CheckedContinuation<Void, Error>?
    private var arrival: CheckedContinuation<Void, Never>?
    private var watchdog: Task<Void, Never>?
    private var suspended = false
    private var result = ReceivedRatingSummary(userId: "parent", count: 105, average: 363.0 / 105)
    private(set) var calls: [String] = []
    func configure(result: ReceivedRatingSummary? = nil, suspended: Bool = false) {
        if let result { self.result = result }; self.suspended = suspended
    }
    func receivedRatings(uid: String) async throws -> ReceivedRatingSummary {
        let value = result; calls.append(uid); watchdog?.cancel(); arrival?.resume(); arrival = nil
        if suspended { suspended = false; try await withCheckedThrowingContinuation { pending = $0 } }
        return value
    }
    func waitForCall() async {
        if !calls.isEmpty { return }
        await withCheckedContinuation { continuation in
            arrival = continuation
            watchdog = Task { [weak self] in
                do { try await Task.sleep(for: .seconds(10)) } catch { return }
                await self?.requireArrival()
            }
        }
    }
    private func requireArrival() { precondition(arrival == nil, "Isolated received-rating request never started") }
    func release(failing: Bool) {
        if failing { pending?.resume(throwing: ReceivedRatingsError.invalidResponse) } else { pending?.resume() }
        pending = nil
    }
}

extension AppDataFixtureGateway {
    func receivedRatings(uid: String) async throws -> ReceivedRatingSummary {
        try await UnconfiguredFirebaseGateway().receivedRatings(uid: uid)
    }
}
