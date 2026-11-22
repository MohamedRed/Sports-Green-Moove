import Foundation

struct ProviderConfigurationError: LocalizedError, Sendable {
    let message: String
    var errorDescription: String? { message }
}
