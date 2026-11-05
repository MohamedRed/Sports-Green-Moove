import Foundation
import CoreFoundation

enum PlaceSearchWire {
    enum Failure: LocalizedError {
        case invalidInput, invalidResponse
        var errorDescription: String? {
            switch self {
            case .invalidInput: "Vérifiez l’adresse saisie ou sélectionnée."
            case .invalidResponse: "Impossible de vérifier cette adresse. Réessayez."
            }
        }
    }
    static func query(_ input: String) throws -> String {
        let value = TeamChatText.normalized(input)
        guard (3...120).contains(value.utf16.count) else { throw Failure.invalidInput }; return value
    }
    static func placeId(_ input: String) throws -> String {
        guard (1...256).contains(input.utf16.count), input == TeamChatText.normalized(input) else { throw Failure.invalidInput }; return input
    }
    private static func text(_ value: Any?) throws -> String {
        guard let text = value as? String, !TeamChatText.normalized(text).isEmpty, text.utf16.count <= 32_768 else { throw Failure.invalidResponse }
        return text
    }
    private static func optional(_ value: Any?) throws -> String? {
        if value == nil || value is NSNull { return nil }; return try text(value)
    }
    static func suggestions(_ raw: Any?) throws -> [PlaceSuggestion] {
        guard let payload = raw as? [String: Any], let rows = payload["suggestions"] as? [[String: Any]] else { throw Failure.invalidResponse }
        let values = try rows.map { row in
            try PlaceSuggestion(placeId: placeId(text(row["placeId"])), label: text(row["label"]),
                mainText: optional(row["mainText"]), secondaryText: optional(row["secondaryText"]))
        }
        try validate(values); return values
    }
    static func resolved(_ raw: Any?) throws -> ResolvedPlace {
        guard let payload = raw as? [String: Any], let row = payload["place"] as? [String: Any],
              let location = row["location"] as? [String: Any] else { throw Failure.invalidResponse }
        func coordinate(_ key: String) throws -> Double {
            guard let value = location[key] as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID(), value.doubleValue.isFinite else { throw Failure.invalidResponse }
            return value.doubleValue
        }
        let value = try ResolvedPlace(placeId: placeId(text(row["placeId"])), label: text(row["label"]),
            formattedAddress: text(row["formattedAddress"]), lat: coordinate("lat"), lng: coordinate("lng"))
        try validate(value); return value
    }
    static func validate(_ values: [PlaceSuggestion]) throws {
        guard values.count <= 100, Set(values.map(\.placeId)).count == values.count else { throw Failure.invalidResponse }
        for value in values {
            _ = try placeId(value.placeId); _ = try text(value.label)
            _ = try optional(value.mainText); _ = try optional(value.secondaryText)
        }
    }
    static func validate(_ value: ResolvedPlace) throws {
        _ = try placeId(value.placeId); _ = try text(value.label); _ = try text(value.formattedAddress)
        guard value.lat.isFinite && value.lng.isFinite && (-90...90).contains(value.lat) && (-180...180).contains(value.lng) else { throw Failure.invalidResponse }
    }
}
