import Foundation

extension AppState {
    func selectAuthorizedRole(_ role: AppRole) async {
        guard let session, session.roles.contains(role), !authenticating else { return }
        selectedRole = role
        await refreshAppData()
    }
}

extension AppRole {
    var profileTitle: String {
        switch self {
        case .parent: "Parent"
        case .driver: "Conducteur"
        case .child: "Enfant"
        case .clubManager: "Responsable du club"
        case .admin: "Administrateur"
        }
    }
}
