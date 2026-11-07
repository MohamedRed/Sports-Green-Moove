import Foundation

extension AppState {
    var locationWorkUnsettled: Bool { nativeLocationShutdown != nil || firebase.nativeLocationWorkPending }

    func drainNativeLocationWork() {
        guard firebase.nativeLocationWorkPending, nativeLocationShutdown == nil else { return }
        nativeLocationShutdown = Task { @MainActor in
            await firebase.awaitNativeLocationShutdown()
            nativeLocationShutdown = nil
        }
    }
}
