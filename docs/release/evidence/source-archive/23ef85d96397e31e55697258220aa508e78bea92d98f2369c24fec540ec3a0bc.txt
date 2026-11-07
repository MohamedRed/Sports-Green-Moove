import Foundation

@MainActor
func checkLocationSessionOwnership() throws {
    let state = LocationSessionState()
    func denied(_ action: () throws -> Void) {
        do { try action() } catch { return }
        fatalError("Invalid location ownership transition was accepted")
    }
    denied { _ = try state.begin(ride: "") }
    let first = try state.begin(ride: "isolated-old")
    denied { _ = try state.begin(ride: "isolated-other") }
    check(!state.revoke(ride: "wrong-ride") && state.owns(first), "Another ride revoked the active capture")
    check(state.revoke(ride: "isolated-old"), "Exact ride could not revoke pending capture")
    denied { try state.requireCurrent(first) }
    denied { _ = try state.beginUpload(first) }
    denied { _ = try state.begin(ride: "isolated-new") }
    state.finishStart(first)

    let active = try state.begin(ride: "isolated-active")
    state.finishStart(active)
    let upload = try state.beginUpload(active)
    state.revoke()
    denied { _ = try state.begin(ride: "isolated-next") }
    state.finishUpload(upload)
    let next = try state.begin(ride: "isolated-next")
    denied { try state.requireCurrent(active) }
    try state.requireCurrent(next)
    state.finishStart(active)
    check(state.owns(next), "Old completion cleared a newer owner")
    state.revoke(); state.finishStart(next)
    print("Location ownership checks passed: exact ride, pending start/upload drain and old-generation denial; no device or network used")
}
