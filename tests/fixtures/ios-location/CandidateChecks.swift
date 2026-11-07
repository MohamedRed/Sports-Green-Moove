import Foundation
import CoreLocation

#if CANDIDATE_LOCATION
@MainActor
func checkControlledLocationLifecycle(_ provider: NativeLocationFallbackProvider) async {
    func start(_ ride: String, _ upload: UploadProbe) -> Task<String, Never> {
        Task {
            do {
                try await provider.startContinuousUpdates(rideSessionId: ride, role: "child") { try await upload.upload($0) }
                return "completed"
            } catch is CancellationError { return "cancelled" }
            catch { return "failed" }
        }
    }
    func require(_ value: Bool, _ message: String) { precondition(value, message) }
    let originalStarts = LocationHarness.starts
    let authorization = UploadProbe()
    LocationHarness.manager!.authorizationStatus = .notDetermined
    let expectedAuthorization = LocationHarness.authorizationRequests + 1
    let beforeCapture = LocationHarness.locationRequests
    let awaitingAuthorization = start("isolated-authorization", authorization)
    await LocationHarness.waitForAuthorization(expectedAuthorization)
    provider.stopContinuousUpdates(rideSessionId: "isolated-authorization")
    LocationHarness.manager!.authorize()
    require(await awaitingAuthorization.value == "cancelled", "Stopped authorization resumed tracking")
    require(LocationHarness.locationRequests == beforeCapture, "Revoked authorization started a location request")
    require(await authorization.calls == 0, "Revoked authorization uploaded a location")

    let capture = UploadProbe()
    let captureRequest = LocationHarness.locationRequests + 1
    let awaitingCapture = start("isolated-capture", capture)
    await LocationHarness.waitForRequest(captureRequest)
    provider.stopContinuousUpdates(rideSessionId: "isolated-capture")
    LocationHarness.manager!.deliver()
    require(await awaitingCapture.value == "cancelled", "Stopped location wait did not complete")
    require(await capture.calls == 0 && LocationHarness.starts == originalStarts, "Stopped capture uploaded or activated tracking")

    let cancelledUpload = UploadProbe()
    let uploadRequest = LocationHarness.locationRequests + 1
    let awaitingUpload = start("isolated-upload", cancelledUpload)
    await LocationHarness.waitForRequest(uploadRequest)
    provider.stopContinuousUpdates(rideSessionId: "another-ride")
    LocationHarness.manager!.deliver()
    await cancelledUpload.waitForUpload()
    let expectedStop = LocationHarness.stops + 1
    awaitingUpload.cancel()
    await LocationHarness.waitForStop(expectedStop)
    let duplicate = await start("isolated-overlap", UploadProbe()).value
    require(duplicate == "failed", "A new start overlapped an unsettled cancelled upload")
    await cancelledUpload.release()
    require(await awaitingUpload.value == "cancelled", "Late upload revived a cancelled start")

    let active = UploadProbe()
    let activeRequest = LocationHarness.locationRequests + 1
    let activation = start("isolated-active", active)
    await LocationHarness.waitForRequest(activeRequest)
    LocationHarness.manager!.deliver(); await active.waitForUpload(); await active.release()
    require(await activation.value == "completed", "A current start could not activate after settled cleanup")
    require(LocationHarness.starts == originalStarts + 1, "Current activation count is incorrect")
    let beforeWrongStop = LocationHarness.stops
    provider.stopContinuousUpdates(rideSessionId: "isolated-upload")
    require(LocationHarness.stops == beforeWrongStop, "An old ride stopped the current stream")
    let duplicateActive = await start("isolated-overlap", UploadProbe()).value
    require(duplicateActive == "failed", "Duplicate start replaced active capture state")
    let oldManager = LocationHarness.manager!
    let oldDelegate = oldManager.delegate!
    provider.stopAllUpdates()
    oldDelegate.locationManager(oldManager, didUpdateLocations: [CLLocation(latitude: 1)])
    require(await active.calls == 1, "A location delivered after stop started another upload")

    let failureRequest = LocationHarness.locationRequests + 1
    let failing = Task {
        do {
            try await provider.startContinuousUpdates(rideSessionId: "isolated-failure", role: "driver") { _ in
                throw ProviderConfigurationError(message: "Controlled upload failure")
            }
            return false
        } catch { return true }
    }
    await LocationHarness.waitForRequest(failureRequest)
    let currentManager = LocationHarness.manager!
    require(currentManager !== oldManager, "A new capture reused the previous manager")
    oldDelegate.locationManager(oldManager, didUpdateLocations: [CLLocation(latitude: 1)])
    oldDelegate.locationManager(oldManager, didFailWithError: ProviderConfigurationError(message: "Old capture failure"))
    currentManager.deliver()
    require(await failing.value, "Initial upload failure was hidden")
    require(LocationHarness.starts == originalStarts + 1, "A failed initial upload enabled continuous capture")
    let origin = UploadProbe()
    let originRequest = LocationHarness.locationRequests + 1
    let newCapture = start("isolated-active", origin)
    await LocationHarness.waitForRequest(originRequest)
    oldDelegate.locationManager(oldManager, didUpdateLocations: [CLLocation(latitude: 1)])
    oldDelegate.locationManager(oldManager, didFailWithError: ProviderConfigurationError(message: "Old capture failure"))
    LocationHarness.manager!.deliver()
    await origin.waitForUpload(); await origin.release()
    require(await newCapture.value == "completed", "Old callbacks poisoned the new capture")
    require(await origin.latitudes == [50.7], "Old coordinates were attached to a new ride")
    provider.stopAllUpdates()
    await checkControlledLocationDrain(provider)
    print("Controlled provider lifecycle passed: permission stop, capture stop, cancellation, serialized starts, exact-ride stop, old-manager isolation and upload failure; no device or network used")
}
#endif
