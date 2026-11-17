import Foundation

struct StripeConnectAccount: Hashable, Sendable {
    let accountId: String
    var reused = false
}

struct StripeConnectAccountLink: Hashable, Sendable {
    let url: String
    let expiresAt: String?
}
