import Foundation
import CryptoKit

enum ChildInvitationWire {
    static func validate(_ link: ChildInvitationLink, target: ChildAccountTarget, now: Int64) throws {
        _ = try ChildAccountWire.target(target)
        let url = link.url
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false), let token = components.percentEncodedFragment else {
            throw ChildAccountError.invalidResponse
        }
        try ChildAccountWire.require(components.scheme == "https" && components.host == "sports-green-moove-prod.web.app" &&
            components.port == nil && components.user == nil && components.password == nil &&
            components.percentEncodedPath == "/child-invitation" && components.percentEncodedQuery == nil && ChildAccountWire.hex(token, count: 64))
        let hash = SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
        try ChildAccountWire.require(link.target == target && link.current.status == .pending &&
            link.current.invitationHash == hash && link.current.expiresAtMillis > now)
    }
    static func link(_ raw: Any?, target: ChildAccountTarget, now: Int64) throws -> ChildInvitationLink {
        guard var row = raw as? [String: Any], let text = row["url"] as? String, let url = URL(string: text) else {
            throw ChildAccountError.invalidResponse
        }
        try ChildAccountWire.require(row["childId"] as? String == target.childId && row["childInstanceId"] as? String == target.childInstanceId)
        row["status"] = "pending"
        let link = ChildInvitationLink(target: target, url: url, current: try ChildAccountWire.summary(row))
        try validate(link, target: target, now: now); return link
    }
}
