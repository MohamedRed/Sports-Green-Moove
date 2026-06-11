import CoreText
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

enum SGM {
    static let green = Color(hex: 0x3EBD6C)
    static let greenLight = Color(hex: 0x60E896)
    static let greenDark = Color(hex: 0x1A8A44)
    static let lime = Color(hex: 0xA8F038)
    static let orange = Color(hex: 0xF97316)
    static let orangeLight = Color(hex: 0xFB923C)
    static let red = Color(hex: 0xEF4444)
    static let textOnGreen = Color.white
    static let heroStart = Color(hex: 0x0D2A18)
    static let heroEnd = Color(hex: 0x163D24)

    static let bgApp = Color.adaptive(light: 0xF1F8F3, dark: 0x0A0F0B)
    static let bgSurface = Color.adaptive(light: 0xFFFFFF, dark: 0x111815)
    static let bgCard = Color.adaptive(light: 0xE8F4ED, dark: 0x172019)
    static let bgElevated = Color.adaptive(light: 0xFFFFFF, dark: 0x1E2E20)
    static let bgInput = Color.adaptive(light: 0xF0F7F2, dark: 0x1A2A1C)
    static let textPrimary = Color.adaptive(light: 0x0C1B0E, dark: 0xEEF8F1)
    static let textSecondary = Color.adaptive(light: 0x3A5640, dark: 0x90B898)
    static let textMuted = Color.adaptive(light: 0x7A9E82, dark: 0x4E6E56)
    static let textInverse = Color.adaptive(light: 0xFFFFFF, dark: 0x0C1B0E)
    static let border = Color.adaptive(light: 0xD0E8D8, dark: 0x1E3022)
    static let borderStrong = Color.adaptive(light: 0x9EC9A9, dark: 0x2E4A32)

    static let heroGradient = LinearGradient(
        colors: [heroStart, heroEnd],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let rewardGradient = LinearGradient(
        colors: [Color(hex: 0x2A1505), Color(hex: 0x3D2410)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

extension Font {
    static func sgmDisplay(_ size: CGFloat) -> Font {
        .custom("BebasNeue-Regular", size: size)
    }

    static func sgmBody(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        switch weight {
        case .bold:
            .custom("DMSans-Bold", size: size)
        case .medium, .semibold:
            .custom("DMSans-Medium", size: size)
        default:
            .custom("DMSans-Regular", size: size)
        }
    }

    static let sgmBodyBase = sgmBody(15)
    static let sgmBodySM = sgmBody(13)
    static let sgmBodyXS = sgmBody(11)
    static let sgmLabel = sgmBody(13, weight: .bold)
}

extension CGFloat {
    static func sgmWide(for size: CGFloat) -> CGFloat { size * 0.06 }
    static func sgmWider(for size: CGFloat) -> CGFloat { size * 0.12 }
    static func sgmWidest(for size: CGFloat) -> CGFloat { size * 0.20 }
}

enum SGMSpace {
    static let s1: CGFloat = 4
    static let s2: CGFloat = 8
    static let s3: CGFloat = 12
    static let s4: CGFloat = 16
    static let s5: CGFloat = 20
    static let s6: CGFloat = 24
    static let s8: CGFloat = 32
    static let s10: CGFloat = 40
    static let s12: CGFloat = 48
    static let s16: CGFloat = 64
    static let padScreen: CGFloat = 20
    static let padCard: CGFloat = 16
}

enum SGMRadius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 28
}

enum SGMSize {
    static let btnSM: CGFloat = 36
    static let btnMD: CGFloat = 48
    static let btnLG: CGFloat = 56
    static let navBar: CGFloat = 64
    static let header: CGFloat = 56
    static let fab: CGFloat = 44
}

struct SGMGridTexture: View {
    var spacing: CGFloat = 24
    var lineColor = SGM.green.opacity(0.07)

    var body: some View {
        Canvas { context, size in
            var path = Path()
            var x: CGFloat = 0
            while x <= size.width {
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                x += spacing
            }
            var y: CGFloat = 0
            while y <= size.height {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                y += spacing
            }
            context.stroke(path, with: .color(lineColor), lineWidth: 1)
        }
        .allowsHitTesting(false)
    }
}

struct Wordmark: View {
    var compact = false

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: compact ? 1 : 2) {
            wordmarkText("SPORTS ", size: compact ? 18 : 18, color: SGM.textMuted)
            wordmarkText("GREEN-", size: compact ? 18 : 18, color: SGM.green)
            wordmarkText("m", size: compact ? 24 : 24, color: SGM.textPrimary)
            wordmarkText("OO", size: compact ? 36 : 38, color: SGM.green)
            wordmarkText("Ve", size: compact ? 24 : 24, color: SGM.textPrimary)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.72)
        .accessibilityLabel("Sports Green Moove")
    }

    private func wordmarkText(_ text: String, size: CGFloat, color: Color) -> some View {
        Text(text)
            .font(.sgmDisplay(size))
            .tracking(size * 0.06)
            .foregroundStyle(color)
    }
}

enum SGMFontRegistrar {
    #if SWIFT_PACKAGE
    private static let resourceBundle = Bundle.module
    #else
    private static let resourceBundle = Bundle.main
    #endif

    static func registerFonts() {
        ["BebasNeue-Regular", "DMSans-Regular", "DMSans-Medium", "DMSans-Bold"].forEach { name in
            guard let url = fontURL(named: name) else {
                return
            }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }

    private static func fontURL(named name: String) -> URL? {
        for subdirectory in ["Fonts", "Resources/Fonts"] {
            if let url = resourceBundle.url(forResource: name, withExtension: "ttf", subdirectory: subdirectory) {
                return url
            }
        }
        return resourceBundle.url(forResource: name, withExtension: "ttf")
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }

    static func adaptive(light: UInt32, dark: UInt32) -> Color {
        #if canImport(UIKit)
        Color(UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(Color(hex: dark))
                : UIColor(Color(hex: light))
        })
        #else
        Color(hex: light)
        #endif
    }
}
