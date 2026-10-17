import SwiftUI

struct SGMScreen<Content: View>: View {
    var spacing: CGFloat = SGMSpace.s4
    var bottomPadding: CGFloat = 96
    var testID: String?
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: spacing) {
                content()
            }
            .padding(.bottom, bottomPadding)
        }
        .sgmUITestIdentifier(testID)
        .background(SGM.bgApp.ignoresSafeArea())
    }
}

struct SGMTopBar: View {
    @Environment(AppState.self) private var appState
    let title: String
    var showsBack = false

    init(title: String, showsBack: Bool = false) {
        self.title = title
        self.showsBack = showsBack
    }

    var body: some View {
        HStack(spacing: 10) {
            if showsBack {
                SGMCircleIconButton(icon: .chevronLeft) {
                    appState.closeOverlay()
                }
            }

            Text(title.uppercased())
                .font(.sgmDisplay(22))
                .tracking(.sgmWide(for: 22))
                .foregroundStyle(SGM.textPrimary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            SGMThemeButton()
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.top, 8)
        .padding(.bottom, 6)
    }
}

struct SGMThemeButton: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        SGMCircleIconButton(
            icon: appState.darkTheme ? .sun : .moon,
            selected: appState.darkTheme
        ) {
            appState.toggleTheme()
        }
    }
}

struct SGMCircleIconButton: View {
    let icon: SGMIcon
    var size: CGFloat = 36
    var selected = false
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            SGMIconView(
                icon: icon,
                size: 16,
                color: selected ? SGM.textOnGreen : SGM.textSecondary
            )
            .frame(width: size, height: size)
            .background(selected ? SGM.green : SGM.bgCard, in: Circle())
            .overlay(Circle().stroke(SGM.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

struct SGMSectionLabel: View {
    let title: String
    var action: String?
    var onAction: (() -> Void)?

    init(_ title: String, action: String? = nil, onAction: (() -> Void)? = nil) {
        self.title = title
        self.action = action
        self.onAction = onAction
    }

    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(.sgmDisplay(19))
                .tracking(.sgmWide(for: 19))
                .foregroundStyle(SGM.textPrimary)
                .lineLimit(1)
            Spacer()
            if let action, let onAction {
                Button(action: onAction) {
                    Text(action)
                        .font(.sgmBody(12, weight: .bold))
                        .foregroundStyle(SGM.green)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.top, SGMSpace.s1)
        .padding(.bottom, SGMSpace.s2)
    }
}

struct SGMButton: View {
    enum Variant {
        case primary
        case ghost
        case orange
    }

    let title: String
    var variant: Variant = .primary
    var full = true
    var testID: String?
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title.uppercased())
                .font(.sgmLabel)
                .tracking(.sgmWide(for: 13))
                .foregroundStyle(foreground)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .frame(maxWidth: full ? .infinity : nil)
                .frame(height: SGMSize.btnMD)
                .padding(.horizontal, SGMSpace.s5)
                .background(background)
                .clipShape(RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous))
                .overlay(border)
        }
        .buttonStyle(.plain)
        .sgmUITestIdentifier(testID)
    }

    private var background: Color {
        switch variant {
        case .primary: SGM.green
        case .ghost: .clear
        case .orange: SGM.orange
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary, .orange: SGM.textOnGreen
        case .ghost: SGM.green
        }
    }

    @ViewBuilder
    private var border: some View {
        if variant == .ghost {
            RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous)
                .stroke(SGM.green, lineWidth: 1.5)
        }
    }
}

struct SGMChip: View {
    let text: String
    var selected: Bool
    var badge: String?
    var testID: String?
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(text.uppercased())
                    .font(.sgmBody(10, weight: .bold))
                    .foregroundStyle(selected ? SGM.textOnGreen : SGM.textMuted)
                if let badge {
                    Text(badge)
                        .font(.sgmBody(9, weight: .bold))
                        .foregroundStyle(SGM.textOnGreen)
                        .frame(width: 16, height: 16)
                        .background(selected ? SGM.greenLight.opacity(0.42) : SGM.orange, in: Circle())
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 34)
            .background(selected ? SGM.green : SGM.bgCard, in: Capsule())
            .overlay(Capsule().stroke(SGM.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .sgmUITestIdentifier(testID)
    }
}

struct SGMAvatar: View {
    let initials: String
    var size: CGFloat = 32
    var muted = false

    var body: some View {
        Text(String(initials.prefix(2)).uppercased())
            .font(.sgmBody(size * 0.30, weight: .bold))
            .foregroundStyle(SGM.textOnGreen)
            .frame(width: size, height: size)
            .background(muted ? SGM.bgElevated : SGM.green, in: Circle())
    }
}
