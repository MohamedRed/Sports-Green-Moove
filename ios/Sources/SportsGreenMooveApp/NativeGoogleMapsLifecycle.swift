import Foundation

#if canImport(GoogleMaps)
import GoogleMaps
#endif

enum NativeGoogleMapsLifecycle {
    static func configureIfAvailable() {
        #if canImport(GoogleMaps)
        guard let key = apiKey else { return }
        GMSServices.provideAPIKey(key)
        #endif
    }

    static var isConfigured: Bool {
        #if canImport(GoogleMaps)
        apiKey != nil
        #else
        false
        #endif
    }

    static var isSdkLinked: Bool {
        #if canImport(GoogleMaps)
        true
        #else
        false
        #endif
    }

    private static var apiKey: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SGMGoogleMapsIOSAPIKey") as? String else {
            return nil
        }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.contains("$(") else { return nil }
        return trimmed
    }
}
