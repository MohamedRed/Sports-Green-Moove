import Foundation

// Only the app container and concrete gateway shell are substituted, not the tested state or fixture methods.
@MainActor final class AppState {
    let accountWork = AccountWorkScope()
    var session: AuthSession?
    var selectedRole: AppRole = .parent
}
struct UITestFirebaseGateway: MembershipGateway {}
