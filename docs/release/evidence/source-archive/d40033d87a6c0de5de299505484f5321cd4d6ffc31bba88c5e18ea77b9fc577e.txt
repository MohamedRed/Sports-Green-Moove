import Foundation

enum SupportWire {
    static func require(_ condition: Bool) throws {
        guard condition else { throw ProviderConfigurationError(message: "Réponse du support invalide. Actualisez votre demande.") }
    }
    static func validCursor(_ value: String?) -> Bool {
        guard let value else { return true }
        return (1...16_384).contains(value.count) && value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil
    }
    static func decode<T: Decodable>(_ type: T.Type, _ value: Any) throws -> T {
        try JSONDecoder().decode(type, from: JSONSerialization.data(withJSONObject: value))
    }
    static func validate(_ reply: SupportReply) throws {
        try require(reply.id.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil)
        try require((1...2000).contains(reply.text.utf16.count) && !reply.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        try require((1...9_007_199_254_740_991).contains(reply.sequence) && (1...9_007_199_254_740_991).contains(reply.sentAtMillis))
    }
    static func validate(_ report: SupportReport) throws {
        try require(!report.id.isEmpty && !report.id.contains("/") && (2...120).contains(report.reason.utf16.count) && (5...2000).contains(report.description.utf16.count))
        try require(report.createdAtMillis > 0 && report.updatedAtMillis >= report.createdAtMillis && report.updatedAtMillis <= 9_007_199_254_740_991)
        try require((0...9_007_199_254_740_991).contains(report.replyCount))
        if let last = report.lastReply { try validate(last); try require(last.sequence == report.replyCount) }
        else { try require(report.replyCount == 0) }
    }
    static func validate<T>(_ page: SupportPage<T>) throws where T: Identifiable, T.ID == String {
        try require(page.items.count <= 20 && Set(page.items.map(\.id)).count == page.items.count && validCursor(page.nextCursor))
        try require(page.nextCursor == nil || !page.items.isEmpty)
    }
    static func reports(_ value: Any) throws -> SupportPage<SupportReport> {
        guard let raw = value as? [String: Any], raw.keys.contains("nextCursor"), let items = raw["items"] as? [[String: Any]] else {
            throw ProviderConfigurationError(message: "Liste du support incomplète.")
        }
        try require(items.allSatisfy { $0.keys.contains("lastReply") })
        let page = try decode(SupportPage<SupportReport>.self, value)
        try validate(page); for report in page.items { try validate(report) }; return page
    }
    static func detail(_ value: Any, reportId: String) throws -> SupportDetail {
        guard let raw = value as? [String: Any], let report = raw["report"] as? [String: Any], report.keys.contains("lastReply"),
              let replies = raw["replies"] as? [String: Any], replies.keys.contains("nextCursor") else {
            throw ProviderConfigurationError(message: "Demande du support incomplète.")
        }
        let detail = try decode(SupportDetail.self, value)
        try validate(detail.report); try validate(detail.replies); try require(detail.report.id == reportId)
        for reply in detail.replies.items { try validate(reply); try require(reply.sequence <= detail.report.replyCount) }
        return detail
    }
}
