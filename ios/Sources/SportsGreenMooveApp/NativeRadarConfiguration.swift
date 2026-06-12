import Foundation

enum NativeRadarConfiguration {
    static var publishableKey: String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SGMRadarPublishableKey") as? String else {
            return ""
        }
        let key = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return key.contains("$(") ? "" : key
    }
}
