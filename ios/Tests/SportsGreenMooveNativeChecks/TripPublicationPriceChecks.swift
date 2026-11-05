import Foundation

func checkTripPublicationPrice() {
    let valid: [(String, Int, String)] = [
        ("", 0, "Gratuit"), ("   ", 0, "Gratuit"), ("0", 0, "Gratuit"), ("0.00", 0, "Gratuit"),
        ("0.29", 29, "0,29 EUR"), ("0,29", 29, "0,29 EUR"), ("0.01", 1, "0,01 EUR"),
        ("4,50", 450, "4,50 EUR"), (" 4.25 ", 425, "4,25 EUR"), ("4.2", 420, "4,20 EUR"),
        ("999.99", 99_999, "999,99 EUR"), ("1000", 100_000, "1000,00 EUR"), ("1000,00", 100_000, "1000,00 EUR"),
    ]
    let invalid = ["invalid", "NaN", "Infinity", "1e300", "-1", "1e2", "0.001", "1000.01", "1001",
        "1,2,3", "1.2.3", "4,", ".5", "00.50", "1 000", "999999999999999999999999", "+1", "1\n2", "1 EUR", "١", "１"]
    for (input, cents, label) in valid {
        check(TripPublicationPrice.cents(input) == cents, "Publication must preserve exact cents: \(input)")
        check(TripPublicationPrice.label(input) == label, "Publication summary must show the exact validated price: \(input)")
    }
    for input in invalid {
        check(TripPublicationPrice.cents(input) == nil, "Publication must reject invalid price without trapping: \(input)")
        check(TripPublicationPrice.label(input) == "Prix invalide", "Invalid price must not display as free: \(input)")
    }
    for cents in 0...100_000 {
        let input = "\(cents / 100).\(String(format: "%02d", cents % 100))"
        check(TripPublicationPrice.cents(input) == cents, "Every supported cent amount must round-trip exactly: \(input)")
    }
    print("Publication price checks passed: exact cents across 100001 supported amounts, thirteen labels and twenty-one malformed inputs; no screen or provider")
}
