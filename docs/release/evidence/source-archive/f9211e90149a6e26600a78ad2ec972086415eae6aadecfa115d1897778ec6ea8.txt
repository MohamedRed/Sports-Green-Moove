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
let suggestion = Data(#"{"suggestions":[{"placeId":"isolated-origin","label":"Adresse fictive"}]}"#.utf8)
let place = Data(#"{"place":{"placeId":"isolated-origin","label":"Adresse fictive","formattedAddress":"Rue fictive 1","location":{"lat":50.5,"lng":4.5}}}"#.utf8)
var cases = 0
for method in ["suggest", "resolve", "approve"] {
    Auth.auth().setUser("owner")
    let before = sdk.count
    do {
        if method == "suggest" { _ = try await gateway.suggestPlaces(uid: "foreign", input: "Synthetic address") }
        else if method == "resolve" { _ = try await gateway.resolvePlace(uid: "foreign", placeId: "isolated-origin") }
        else { _ = try await gateway.approveBooking(uid: "foreign", bookingId: "isolated-booking") }
        preconditionFailure("Wrong SDK identity dispatched a place request")
    } catch {}
    require(sdk.count == before, "Unowned request reached SDK callback boundary")
    for result in ["success", "error", "signout", "other-user", "cancel"] {
        Auth.auth().setUser("owner")
        let task = Task { @MainActor () -> Bool in
            do {
                if method == "suggest" { _ = try await gateway.suggestPlaces(uid: "owner", input: "  Synthetic address  ") }
                else if method == "resolve" { _ = try await gateway.resolvePlace(uid: "owner", placeId: "isolated-origin") }
                else { _ = try await gateway.approveBooking(uid: "owner", bookingId: "isolated-booking") }
                return true
            } catch { return false }
        }
        await waitForCallback()
        let last = sdk.last!, payload = try JSONSerialization.jsonObject(with: last.1) as! [String: String]
        let name = method == "suggest" ? "suggestPlaces" : method == "resolve" ? "resolvePlace" : "approveBooking"
        let input = method == "suggest" ? ["input": "Synthetic address"] : method == "resolve" ? ["placeId": "isolated-origin"] : ["bookingId": "isolated-booking"]
        require(last.0 == name, "Owned callable changed")
        require(payload == input, "Owned input mutated before dispatch")
        if result == "signout" { Auth.auth().setUser(nil) }
        if result == "other-user" { Auth.auth().setUser("other") }
        if result == "cancel" { task.cancel() }
        sdk.release(method == "suggest" ? suggestion : method == "resolve" ? place : Data(#"{"status":"approved"}"#.utf8),
            error: result == "error" ? NSError(domain: "isolated-transport", code: 1) : nil)
        let accepted = await task.value
        require(accepted == (result == "success"), "Place SDK result escaped identity or cancellation boundary")
        require(sdk.pending == 0, "Scripted place callback did not drain"); cases += 1
    }
}
Auth.auth().setUser("owner")
let before = sdk.count
let trip = TripSummary(id: "isolated-trip", title: "Isolated trip", club: "Club", category: "U8", departureLabel: "Tomorrow", seatsAvailable: 2, priceLabel: "4 EUR", reasons: [])
do {
    _ = try await gateway.requestBooking(uid: "foreign", trip: trip, childId: nil, seats: 1)
    preconditionFailure("Foreign booking owner reached local intent preparation")
} catch BookingRecoveryError.accountChanged {} catch { preconditionFailure("Booking owner was not checked before payload/storage work") }
require(sdk.count == before, "Foreign booking owner dispatched an SDK call")
print("OwnedPlacesAdapterChecks passed: \(cases) actual address/approval success/error/identity/cancellation cases and four pre-call denials; scripted callback boundary only, no SDK binary, map service, booking storage write or phone")
