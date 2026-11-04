import Foundation
import os

public enum CLAuthorizationStatus: Int32, Sendable {
    case notDetermined, restricted, denied, authorizedAlways, authorizedWhenInUse
}

public let kCLLocationAccuracyBest: Double = -1
public struct CLLocationCoordinate2D {
    public let latitude: Double
    public let longitude: Double
}
public final class CLLocation {
    public let coordinate: CLLocationCoordinate2D
    public let horizontalAccuracy = 5.0
    public let timestamp = Date(timeIntervalSince1970: 1_793_815_200)
    public let speed = 0.0
    public let course = 0.0
    public init(latitude: Double = 50.7) { coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: 4.6) }
}

public protocol CLLocationManagerDelegate: AnyObject {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager)
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation])
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error)
}

@MainActor public enum LocationHarness {
    public static var manager: CLLocationManager?
    public private(set) static var locationRequests = 0
    public private(set) static var authorizationRequests = 0
    public private(set) static var starts = 0
    public private(set) static var stops = 0
    private static var observers: [(Int, CheckedContinuation<Void, Never>)] = []
    private static var authorizationObservers: [(Int, CheckedContinuation<Void, Never>)] = []
    private static var stopObservers: [(Int, CheckedContinuation<Void, Never>)] = []
    public static func waitForRequest(_ count: Int) async {
        if locationRequests >= count { return }
        await withCheckedContinuation { observers.append((count, $0)) }
    }
    public static func requested() {
        locationRequests += 1
        let ready = observers.filter { $0.0 <= locationRequests }
        observers.removeAll { $0.0 <= locationRequests }
        for (_, observer) in ready { observer.resume() }
    }
    public static func waitForAuthorization(_ count: Int) async {
        if authorizationRequests >= count { return }
        await withCheckedContinuation { authorizationObservers.append((count, $0)) }
    }
    public static func authorizationRequested() {
        authorizationRequests += 1
        let ready = authorizationObservers.filter { $0.0 <= authorizationRequests }
        authorizationObservers.removeAll { $0.0 <= authorizationRequests }
        for (_, observer) in ready { observer.resume() }
    }
    public static func waitForStop(_ count: Int) async {
        if stops >= count { return }
        await withCheckedContinuation { stopObservers.append((count, $0)) }
    }
    public static func stopped() {
        stops += 1
        let ready = stopObservers.filter { $0.0 <= stops }
        stopObservers.removeAll { $0.0 <= stops }
        for (_, observer) in ready { observer.resume() }
    }
    public static func started() { starts += 1 }
}

public final class CLLocationManager {
    public weak var delegate: (any CLLocationManagerDelegate)?
    private static let status = OSAllocatedUnfairLock(initialState: CLAuthorizationStatus.authorizedAlways)
    public var authorizationStatus: CLAuthorizationStatus {
        get { Self.status.withLock { $0 } }
        set { Self.status.withLock { $0 = newValue } }
    }
    public var desiredAccuracy = 0.0
    public var allowsBackgroundLocationUpdates = false
    public var pausesLocationUpdatesAutomatically = true
    public private(set) var locationRequests = 0
    public private(set) var authorizationRequests = 0
    public private(set) var starts = 0
    public private(set) var stops = 0

    @MainActor public init(owned: Bool = true) { LocationHarness.manager = self }
    @MainActor public func requestAlwaysAuthorization() {
        authorizationRequests += 1
        LocationHarness.authorizationRequested()
    }
    @MainActor public func requestLocation() {
        locationRequests += 1
        LocationHarness.requested()
    }
    @MainActor public func startUpdatingLocation() { starts += 1; LocationHarness.started() }
    @MainActor public func stopUpdatingLocation() { stops += 1; LocationHarness.stopped() }
    public func deliver() { delegate?.locationManager(self, didUpdateLocations: [CLLocation()]) }
    public func authorize() {
        authorizationStatus = .authorizedAlways
        delegate?.locationManagerDidChangeAuthorization(self)
    }
}
