import Foundation

enum MembershipPolicy {
    @MainActor static func request(_ access: AccountAccess) -> Bool {
        access.isCurrent && !access.context.grantedRoles.contains(.child) && access.context.role != .child
    }
    @MainActor static func review(_ access: AccountAccess) -> Bool {
        request(access) && [AppRole.clubManager, .admin].contains(access.context.role)
    }
}
