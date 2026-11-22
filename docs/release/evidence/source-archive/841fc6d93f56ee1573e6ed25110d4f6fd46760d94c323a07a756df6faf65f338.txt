import Foundation
import CoreLocation

#if CANDIDATE_LOCATION
private actor LocationDrainProbe {
    private var pending: [Int: CheckedContinuation<Void, Error>] = [:]
    private var observers: [(Int, CheckedContinuation<Void, Never>)] = []
    private(set) var calls = 0
    func upload(_ update: NativeLocationBatchUpdate) async throws {
        calls += 1
        let ordinal = calls
        try await withCheckedThrowingContinuation { continuation in
            pending[ordinal] = continuation
            let ready = observers.filter { $0.0 <= calls }
            observers.removeAll { $0.0 <= calls }
            for (_, observer) in ready { observer.resume() }
        }
    }
    func waitForCall(_ count: Int) async {
        if calls >= count { return }
        await withCheckedContinuation { observers.append((count, $0)) }
    }
    func release(_ ordinal: Int, failing: Bool = false) {
        guard let continuation = pending.removeValue(forKey: ordinal) else { preconditionFailure("No suspended upload") }
        if failing { continuation.resume(throwing: ProviderConfigurationError(message: "Synthetic transport failure")) }
        else { continuation.resume() }
    }
}

@MainActor private final class ShutdownReceipt {
    var finished = false
    private var entered = false
    private var observer: CheckedContinuation<Void, Never>?
    func enter() { entered = true; observer?.resume(); observer = nil }
    func waitForEntry() async {
        if entered { return }
        await withCheckedContinuation { observer = $0 }
    }
}

@MainActor func checkControlledLocationDrain(_ provider: NativeLocationFallbackProvider) async {
    func start(_ probe: LocationDrainProbe) -> Task<String, Never> {
        Task {
            do {
                try await provider.startContinuousUpdates(rideSessionId: "isolated-drain", role: "driver") {
                    try await probe.upload($0)
                }
                return "completed"
            } catch is CancellationError { return "cancelled" }
            catch { return "failed" }
        }
    }
    for failing in [false, true] {
        let probe = LocationDrainProbe()
        let request = LocationHarness.locationRequests + 1
        let startup = start(probe)
        await LocationHarness.waitForRequest(request)
        LocationHarness.manager!.deliver(); await probe.waitForCall(1)
        provider.stopAllUpdates()
        let receipt = ShutdownReceipt()
        let drain = Task { receipt.enter(); await provider.awaitShutdown(); receipt.finished = true }
        await receipt.waitForEntry()
        precondition(provider.hasPendingWork && !receipt.finished, "Stopped initial upload was reported settled before its callback")
        drain.cancel()
        await probe.release(1, failing: failing)
        let result = await startup.value
        precondition(result == (failing ? "failed" : "cancelled"), "Stopped startup revived tracking")
        await drain.value
        precondition(receipt.finished && !provider.hasPendingWork, "Initial completion did not release the shutdown waiter")
    }
    let probe = LocationDrainProbe()
    let request = LocationHarness.locationRequests + 1
    let startup = start(probe)
    await LocationHarness.waitForRequest(request)
    let manager = LocationHarness.manager!
    manager.deliver(); await probe.waitForCall(1); await probe.release(1)
    let activation = await startup.value
    precondition(activation == "completed", "Continuous test did not start")
    let delegate = manager.delegate!
    manager.deliver(); manager.deliver(); await probe.waitForCall(3)
    provider.stopAllUpdates()
    delegate.locationManager(manager, didUpdateLocations: [CLLocation(latitude: 1)])
    let first = ShutdownReceipt(), second = ShutdownReceipt()
    let a = Task { first.enter(); await provider.awaitShutdown(); first.finished = true }
    let b = Task { second.enter(); await provider.awaitShutdown(); second.finished = true }
    await first.waitForEntry(); await second.waitForEntry()
    precondition(provider.hasPendingWork && !first.finished && !second.finished, "Continuous uploads were discarded at stop")
    a.cancel()
    await probe.release(2)
    precondition(provider.hasPendingWork && !first.finished && !second.finished, "A partial completion released shutdown")
    await probe.release(3, failing: true)
    await a.value; await b.value
    precondition(first.finished && second.finished && !provider.hasPendingWork, "All callbacks did not release all waiters")
    let calls = await probe.calls
    precondition(calls == 3, "An old callback added an upload after shutdown")
    await provider.awaitShutdown()
    print("Controlled provider drain passed: delayed initial success/error, two continuous uploads, partial completion, two waiters, cancelled waiter, old callback suppression and idle shutdown; no device or network used")
}
#endif
