import Foundation

enum SupportStatus: String, Decodable, Sendable {
    case open, reviewing, closed
    var label: String { switch self { case .open: "Reçue"; case .reviewing: "En cours"; case .closed: "Clôturée" } }
}
struct SupportReply: Decodable, Identifiable, Equatable, Sendable {
    let id: String
    let text: String
    let sequence: Int64
    let sentAtMillis: Int64
}
struct SupportReport: Decodable, Identifiable, Equatable, Sendable {
    let id: String
    let reason: String
    let description: String
    let emergency: Bool
    let status: SupportStatus
    let createdAtMillis: Int64
    let updatedAtMillis: Int64
    let replyCount: Int64
    let lastReply: SupportReply?
}
struct SupportPage<Item: Decodable & Sendable>: Decodable, Sendable {
    let items: [Item]
    let nextCursor: String?
}
struct SupportDetail: Decodable, Sendable {
    let report: SupportReport
    let replies: SupportPage<SupportReply>
}
protocol SupportGateway: Sendable {
    func supportReports(uid: String, cursor: String?) async throws -> SupportPage<SupportReport>
    func supportReport(uid: String, reportId: String, cursor: String?) async throws -> SupportDetail
}
struct UnconfiguredSupportGateway: SupportGateway {
    func supportReports(uid: String, cursor: String?) async throws -> SupportPage<SupportReport> { throw unavailable }
    func supportReport(uid: String, reportId: String, cursor: String?) async throws -> SupportDetail { throw unavailable }
    private var unavailable: ProviderConfigurationError { .init(message: "Veuillez vous connecter pour consulter vos demandes.") }
}
