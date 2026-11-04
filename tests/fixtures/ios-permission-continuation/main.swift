import Foundation

@MainActor func checkBridge() async throws {
    let bridge = PermissionBridge()
    for (index, authorized) in [true, false, true].enumerated() {
        let task = Task { () throws -> Bool in
            do { try await bridge.start(); return true }
            catch is CancellationError { return false }
        }
        await bridge.manager.waitForRequest(index + 1)
        do { try await bridge.start(); fatalError("Duplicate permission request accepted") }
        catch is ProviderConfigurationError {}
        precondition(bridge.manager.requests == index + 1)
        bridge.finish(authorized: authorized)
        let result = try await task.value
        precondition(result == authorized)
    }
    print("Actual permission continuation passed: typed Void, duplicate denial, success, cancellation and reuse; synthetic manager, not an SDK permission or device test")
}

try await checkBridge()
