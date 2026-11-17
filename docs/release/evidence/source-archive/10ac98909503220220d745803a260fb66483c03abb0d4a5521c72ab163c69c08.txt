import Foundation

enum NativeStripeConnectConfiguration {
    static var urls: (returnUrl: String, refreshUrl: String)? {
        guard let returnUrl = configuredValue(bundleKey: "SGMStripeConnectReturnURL", environmentKey: "SGM_STRIPE_CONNECT_RETURN_URL"),
              let refreshUrl = configuredValue(bundleKey: "SGMStripeConnectRefreshURL", environmentKey: "SGM_STRIPE_CONNECT_REFRESH_URL")
        else {
            return nil
        }
        return (returnUrl, refreshUrl)
    }

    private static func configuredValue(bundleKey: String, environmentKey: String) -> String? {
        if let bundleValue = Bundle.main.object(forInfoDictionaryKey: bundleKey) as? String,
           !bundleValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return bundleValue
        }
        let environmentValue = ProcessInfo.processInfo.environment[environmentKey] ?? ""
        let trimmed = environmentValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
