import Foundation

struct SearchFormState: Hashable, Sendable {
    var desiredDepartureAtIso: String
    var seatsNeeded: Int
    var baggage: String
    var returnTrip: Bool
    var requireChildTracking: Bool {
        didSet { if requireChildTracking != oldValue { guardianConsent = false } }
    }
    var guardianConsent: Bool
    var childUserId: String? {
        didSet { if childUserId != oldValue { guardianConsent = false } }
    }

    static func initial(now: Date = Date()) -> Self {
        Self(desiredDepartureAtIso: ISO8601DateFormatter().string(from: now.addingTimeInterval(86_400)),
            seatsNeeded: 1, baggage: "medium", returnTrip: false,
            requireChildTracking: true, guardianConsent: false, childUserId: nil)
    }

    var validationMessage: String? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = desiredDepartureAtIso.contains(".") ? [.withInternetDateTime, .withFractionalSeconds] : [.withInternetDateTime]
        guard formatter.date(from: desiredDepartureAtIso) != nil else {
            return "Choisissez une date et une heure de départ valides."
        }
        guard (1...8).contains(seatsNeeded), ["small", "medium", "large"].contains(baggage) else {
            return "Vérifiez les options de recherche."
        }
        if let childUserId, childUserId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Choisissez un enfant valide."
        }
        guard !requireChildTracking || childUserId != nil else {
            return "Choisissez un enfant pour activer le suivi enfant."
        }
        guard guardianConsent else {
            return requireChildTracking ? "Votre consentement est nécessaire pour activer le suivi enfant."
                : "Votre consentement est nécessaire avant de rechercher un trajet."
        }
        return nil
    }
}
