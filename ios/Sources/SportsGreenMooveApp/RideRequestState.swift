import Foundation
import Observation

struct RideRequest: Equatable, Sendable {
    let id: UUID
    let uid: String
    let role: AppRole
}

@MainActor @Observable
final class RideRequestState {
    private var revision = UUID()
    private var pending: RideRequest?
    var busy: Bool { pending != nil }

    func begin(uid: String?, role: AppRole) -> RideRequest? {
        guard let uid, !uid.isEmpty, pending == nil, !Task.isCancelled else { return nil }
        let request = RideRequest(id: UUID(), uid: uid, role: role)
        revision = request.id; pending = request
        return request
    }

    func owns(_ request: RideRequest, uid: String?, role: AppRole) -> Bool {
        pending == request && revision == request.id && request.uid == uid && request.role == role
    }

    func requireCurrent(_ request: RideRequest, uid: String?, role: AppRole) throws {
        try Task.checkCancellation()
        guard owns(request, uid: uid, role: role) else { throw CancellationError() }
    }

    func invalidate() { revision = UUID() }
    func finish(_ request: RideRequest) { if pending == request { pending = nil } }
}

extension AppState {
    func invalidateRideWork() {
        rideRequests.invalidate()
        activeRidePermissionDisclosure = nil
        ridePermissions.cancelPending()
        firebase.stopAllNativeLocationFallback()
        radar.stopLocalTracking()
    }

    func beginRideRequest() -> RideRequest? {
        guard let session, session.isValid, session.roles.contains(selectedRole) else { return nil }
        return rideRequests.begin(uid: session.uid, role: selectedRole)
    }

    func requireCurrentRideRequest(_ request: RideRequest) throws {
        try rideRequests.requireCurrent(request, uid: session?.uid, role: selectedRole)
    }
}
