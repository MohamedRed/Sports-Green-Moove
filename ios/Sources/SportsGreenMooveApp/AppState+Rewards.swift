import Foundation

extension AppState {
    func openRewardPayments(access: AccountAccess) {
        guard access.isCurrent, accountAccess?.context == access.context, overlay == .rewards else { return }
        guard access.context.grantedRoles.contains(.driver), !access.context.grantedRoles.contains(.child) else {
            errorMessage = "Les versements nécessitent un profil conducteur validé."
            return
        }
        errorMessage = nil
        noticeMessage = nil
        selectedRole = .driver
        openOverlay(.payments)
    }
}
