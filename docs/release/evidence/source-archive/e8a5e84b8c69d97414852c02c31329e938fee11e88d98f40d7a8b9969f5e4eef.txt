import Foundation

@MainActor func checkRewardNavigation() {
    func app(_ roles: [AppRole] = [.parent, .driver], role: AppRole = .parent) -> AppState {
        let value = AppState(auth: UnconfiguredAuthGateway(), firebase: UnconfiguredFirebaseGateway())
        value.session = AuthSession(uid: "isolated-rewards", email: nil, displayName: nil, roles: roles)
        value.selectedRole = role
        value.overlay = .rewards
        return value
    }
    for role: AppRole in [.parent, .driver] {
        let value = app(role: role), access = value.accountAccess!
        value.errorMessage = "Old error"; value.noticeMessage = "Old notice"
        value.openRewardPayments(access: access)
        check(value.overlay == .payments && value.selectedRole == .driver, "Granted driver cannot open owned payment settings")
        check(value.accountAccess?.isCurrent == true && value.accountAccess?.context.role == .driver, "Payments opened without a current driver generation")
        check(value.errorMessage == nil && value.noticeMessage == nil, "Navigation retained obsolete feedback")
        check(!value.ridePaymentBusy && value.pendingRidePayment == nil && !value.accountWork.busy, "Navigation must not initiate a payment")
    }
    for roles: [AppRole] in [[.parent], [.child], [.clubManager], [.parent, .clubManager]] {
        let value = app(roles, role: roles[0])
        value.openRewardPayments(access: value.accountAccess!)
        check(value.overlay == .rewards && value.selectedRole == roles[0], "Unavailable driver authority was manufactured")
        check(value.errorMessage == "Les versements nécessitent un profil conducteur validé.", "Denied navigation needs explicit feedback")
    }
    let invalid = app([.child, .driver], role: .child)
    check(invalid.accountAccess == nil, "Invalid mixed child authority must not create account access")
    for boundary in ["signout", "other-account", "same-account", "role-roundtrip", "roles-revoked", "closed", "foreign-scope"] {
        let value = app(), access = value.accountAccess!
        switch boundary {
        case "signout": value.session = nil
        case "other-account": value.session = AuthSession(uid: "other", email: nil, displayName: nil, roles: [.parent, .driver])
        case "same-account": let original = value.session; value.session = nil; value.session = original
        case "role-roundtrip": value.selectedRole = .driver; value.selectedRole = .parent
        case "roles-revoked": value.session = AuthSession(uid: "isolated-rewards", email: nil, displayName: nil, roles: [.parent])
        case "closed": value.overlay = .options
        default: break
        }
        let beforeRole = value.selectedRole, beforeOverlay = value.overlay, beforeContext = value.accountAccess?.context
        value.errorMessage = "Current error"; value.noticeMessage = "Current notice"
        let submitted = boundary == "foreign-scope" ? app().accountAccess! : access
        value.openRewardPayments(access: submitted)
        check(value.selectedRole == beforeRole && value.overlay == beforeOverlay && value.accountAccess?.context == beforeContext,
            "Stale rewards action crossed its account, role or screen boundary")
        check(value.errorMessage == "Current error" && value.noticeMessage == "Current notice", "Stale rewards action changed current feedback")
    }
    print("Reward navigation checks passed: two granted routes, four denials, invalid mixed roles and seven stale boundaries; no provider or transfer")
}
