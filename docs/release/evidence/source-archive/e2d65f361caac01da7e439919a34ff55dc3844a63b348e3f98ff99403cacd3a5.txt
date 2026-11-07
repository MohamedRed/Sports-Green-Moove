import Foundation
import FirebaseAuth
import FirebaseFunctions

struct FirebaseBackendGateway: Sendable {}
func require(_ value: @autoclosure () -> Bool, _ message: String) { precondition(value(), message) }
@MainActor func waitForCallback() async {
    let deadline = ContinuousClock.now.advanced(by: .seconds(10))
    while TestFunctions.shared.pending == 0 { precondition(ContinuousClock.now < deadline); await Task.yield() }
}
let gateway = FirebaseBackendGateway(), sdk = TestFunctions.shared
let page = Data(#"{"items":[],"nextCursor":null}"#.utf8)
let receipt = Data(#"{"bookingId":"owned-booking","status":"cancelled"}"#.utf8)
var checked = 0
for method in ["list", "cancel"] {
    Auth.auth().setUser("parent")
    let before = sdk.count
    do {
        if method == "list" { _ = try await gateway.parentReservations(uid: "other", cursor: nil) }
        else { _ = try await gateway.cancelParentReservation(uid: "other", bookingId: "owned-booking") }
        preconditionFailure("Foreign parent dispatched a reservation request")
    } catch {}
    require(sdk.count == before, "Foreign owner crossed the SDK boundary")
    for outcome in ["success", "error", "signout", "other-user", "cancel", "malformed"] {
        Auth.auth().setUser("parent")
        let task = Task { @MainActor () -> Bool in
            do {
                if method == "list" { _ = try await gateway.parentReservations(uid: "parent", cursor: "next") }
                else { _ = try await gateway.cancelParentReservation(uid: "parent", bookingId: "owned-booking") }
                return true
            } catch { return false }
        }
        await waitForCallback()
        let last = sdk.last!, input = try JSONSerialization.jsonObject(with: last.1) as! [String: String]
        require(last.0 == (method == "list" ? "listReservations" : "cancelBooking"), "Reservation callable changed")
        require(input == (method == "list" ? ["role": "parent", "cursor": "next"] : ["bookingId": "owned-booking"]),
            "Reservation request lost its role, cursor or exact target")
        if outcome == "signout" { Auth.auth().setUser(nil) }
        if outcome == "other-user" { Auth.auth().setUser("other") }
        if outcome == "cancel" { task.cancel() }
        sdk.release(outcome == "malformed" ? Data(#"{}"#.utf8) : method == "list" ? page : receipt,
            error: outcome == "error" ? NSError(domain: "isolated-transport", code: 1) : nil)
        let accepted = await task.value
        require(accepted == (outcome == "success"), "Reservation response escaped its owner, cancellation or decoding boundary")
        require(sdk.pending == 0, "Reservation callback leaked"); checked += 1
    }
}
Auth.auth().setUser("parent")
let before = sdk.count
for invalid in ["cursor", "booking-id", "owner-id"] {
    do {
        if invalid == "cursor" { _ = try await gateway.parentReservations(uid: "parent", cursor: "") }
        else { _ = try await gateway.cancelParentReservation(uid: invalid == "owner-id" ? "../other" : "parent", bookingId: invalid == "booking-id" ? "../other" : "owned-booking") }
        preconditionFailure("Malformed reservation input dispatched")
    } catch {}
}
require(sdk.count == before, "Malformed input reached the SDK callback")
print("ParentReservationAdapterChecks passed: \(checked) actual list/cancel callback outcomes and five pre-call denials; exact owned payloads, no Firebase SDK binary, server mutation or phone")
