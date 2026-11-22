import Foundation

enum TeamChatPolicy {
    @MainActor static func permits(_ access: AccountAccess) -> Bool {
        access.isCurrent && TeamChatWire.validId(access.context.uid) && !access.context.grantedRoles.contains(.child) &&
        [.parent, .driver, .clubManager].contains(access.context.role)
    }
}
