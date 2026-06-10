import SwiftUI

enum SGMColor {
    static let green = Color(red: 0.24, green: 0.74, blue: 0.42)
    static let greenLight = Color(red: 0.38, green: 0.91, blue: 0.59)
    static let greenDark = Color(red: 0.10, green: 0.54, blue: 0.27)
    static let lime = Color(red: 0.66, green: 0.94, blue: 0.22)
    static let orange = Color(red: 0.98, green: 0.45, blue: 0.08)
    static let red = Color(red: 0.94, green: 0.27, blue: 0.27)
    static let appBackground = Color(red: 0.95, green: 0.98, blue: 0.95)
    static let surface = Color.white
    static let card = Color(red: 0.91, green: 0.96, blue: 0.93)
    static let input = Color(red: 0.94, green: 0.97, blue: 0.95)
    static let textPrimary = Color(red: 0.05, green: 0.11, blue: 0.06)
    static let textSecondary = Color(red: 0.23, green: 0.34, blue: 0.25)
    static let textMuted = Color(red: 0.48, green: 0.62, blue: 0.51)
    static let border = Color(red: 0.82, green: 0.91, blue: 0.85)
}

enum SGMSpacing {
    static let x1: CGFloat = 4
    static let x2: CGFloat = 8
    static let x3: CGFloat = 12
    static let x4: CGFloat = 16
    static let x5: CGFloat = 20
    static let x6: CGFloat = 24
    static let x8: CGFloat = 32
}

struct Wordmark: View {
    var compact = false

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: compact ? 1 : 2) {
            Text("SPORTS ")
                .foregroundStyle(SGMColor.textMuted)
                .font(.system(size: compact ? 13 : 18, weight: .black))
            Text("GREEN-")
                .foregroundStyle(SGMColor.green)
                .font(.system(size: compact ? 13 : 18, weight: .black))
            Text("m")
                .foregroundStyle(SGMColor.textPrimary)
                .font(.system(size: compact ? 18 : 24, weight: .black))
            Text("OO")
                .foregroundStyle(SGMColor.green)
                .font(.system(size: compact ? 30 : 38, weight: .black))
            Text("Ve")
                .foregroundStyle(SGMColor.textPrimary)
                .font(.system(size: compact ? 18 : 24, weight: .black))
        }
        .lineLimit(1)
        .minimumScaleFactor(0.72)
        .accessibilityLabel("Sports Green Moove")
    }
}
