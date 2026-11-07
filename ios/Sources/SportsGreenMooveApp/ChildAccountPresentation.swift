import Foundation

enum ChildAccountPresentation: Identifiable {
    case child(UUID)
    case parent(UUID, ChildAccountTarget)

    var id: UUID {
        switch self { case .child(let id), .parent(let id, _): id }
    }
    var target: ChildAccountTarget? {
        switch self { case .child: nil; case .parent(_, let target): target }
    }
    @MainActor init(access: AccountAccess, view: EmergencyContactView?) throws {
        guard access.isCurrent else { throw ChildAccountError.invalidResponse }
        if let view {
            guard access.context.role == .parent, !access.context.grantedRoles.contains(.child),
                view.ownerUid == access.context.uid else { throw ChildAccountError.invalidResponse }
            self = .parent(UUID(), try ChildAccountTarget(view: view))
        } else {
            guard access.context.role == .child, access.context.grantedRoles == [.child] else { throw ChildAccountError.invalidResponse }
            self = .child(UUID())
        }
    }
}
