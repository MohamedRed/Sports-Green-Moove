import Foundation

func tripDateLabel(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "fr_BE")
    formatter.timeZone = TimeZone(identifier: "Europe/Brussels")!
    formatter.dateFormat = "EEE dd MMM"
    return formatter.string(from: date).replacingOccurrences(of: ".", with: "").uppercased()
}

func tripTimeLabel(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "fr_BE")
    formatter.timeZone = TimeZone(identifier: "Europe/Brussels")!
    formatter.dateFormat = "HH'h'mm"
    return formatter.string(from: date)
}
