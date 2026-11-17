import Foundation

enum TripPublicationPrice {
    static let validationMessage = "Le prix doit être compris entre 0 et 1 000 EUR, avec deux décimales maximum."

    static func cents(_ value: String) -> Int? {
        let text = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty { return 0 }
        guard text.range(of: "^(0|[1-9][0-9]{0,3})([,.][0-9]{1,2})?$", options: .regularExpression) == text.startIndex..<text.endIndex,
              let amount = Decimal(string: text.replacingOccurrences(of: ",", with: "."), locale: Locale(identifier: "en_US_POSIX"))
        else { return nil }
        let cents = amount * 100
        guard cents >= 0, cents <= 100_000 else { return nil }
        return NSDecimalNumber(decimal: cents).intValue
    }

    static func label(_ value: String) -> String {
        guard let cents = cents(value) else { return "Prix invalide" }
        if cents == 0 { return "Gratuit" }
        return "\(cents / 100),\(String(format: "%02d", cents % 100)) EUR"
    }
}
