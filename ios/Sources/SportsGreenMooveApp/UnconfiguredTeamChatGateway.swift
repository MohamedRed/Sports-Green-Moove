import Foundation

extension UnconfiguredFirebaseGateway {
    func teamChatChoices(uid: String, clubId: String?, cursor: String?) async throws -> TeamChatChoices { throw unavailableTeamChat }
    func teamChatMessages(uid: String, target: TeamChatTarget, cursor: String?) async throws -> TeamChatPage { throw unavailableTeamChat }
    func sendTeamChat(uid: String, target: TeamChatTarget, body: String, requestId: UUID) async throws -> String { throw unavailableTeamChat }
    func readTeamChat(uid: String, target: TeamChatTarget, accessVersion: String, ids: [String]) async throws { throw unavailableTeamChat }
    private var unavailableTeamChat: ProviderConfigurationError { .init(message: "Les conversations d’équipe ne sont pas configurées.") }
}
