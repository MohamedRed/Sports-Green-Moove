import Foundation
import CoreLocation

let provider = NativeLocationFallbackProvider.shared
let upload = UploadProbe()
let start = Task {
    do {
        try await provider.startContinuousUpdates(rideSessionId: "isolated-pending-ride", role: "driver") {
            try await upload.upload($0)
        }
        return "completed"
    } catch is CancellationError { return "cancelled" }
    catch { return "failed" }
}
await LocationHarness.waitForRequest(1)
guard let manager = LocationHarness.manager else { fatalError("Controlled location module was not selected") }
manager.deliver()
await upload.waitForUpload()
provider.stopContinuousUpdates(rideSessionId: "isolated-pending-ride")
await upload.release()
let result = await start.value
print("startResult=\(result)")
print("continuousStartsAfterStop=\(manager.starts)")
print("localStopCalls=\(manager.stops)")
print("initialUploads=\(await upload.calls)")
#if CANDIDATE_LOCATION
await checkControlledLocationLifecycle(provider)
#endif
