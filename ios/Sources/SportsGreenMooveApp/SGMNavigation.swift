import SwiftUI

struct SGMTabBar: View {
    let selected: AppTab
    var onSelect: (AppTab) -> Void

    var body: some View {
        ZStack {
            HStack {
                navItem(.home)
                navItem(.trips)
                Spacer(minLength: 64)
                navItem(.messages)
                navItem(.profile)
            }
            .frame(height: SGMSize.navBar)
            .padding(.horizontal, 18)
            .background(SGM.bgSurface.opacity(0.96))
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(SGM.border)
                    .frame(height: 1)
            }

            Button {
                onSelect(.publish)
            } label: {
                SGMIconView(icon: .plus, size: 24, color: SGM.textOnGreen)
                    .frame(width: SGMSize.fab, height: SGMSize.fab)
                    .background(SGM.green, in: Circle())
                    .overlay(Circle().stroke(SGM.bgSurface, lineWidth: 3))
                    .shadow(color: SGM.green.opacity(0.34), radius: 10, y: 4)
            }
            .buttonStyle(.plain)
            .offset(y: -12)
        }
        .frame(maxWidth: .infinity)
        .ignoresSafeArea(.container, edges: .bottom)
    }

    private func navItem(_ tab: AppTab) -> some View {
        Button {
            onSelect(tab)
        } label: {
            let active = selected == tab
            VStack(spacing: 3) {
                SGMIconView(
                    icon: tab.icon,
                    size: 18,
                    color: active ? SGM.green : SGM.textMuted
                )
                Text(tab.title.uppercased())
                    .font(.sgmDisplay(9))
                    .tracking(.sgmWide(for: 9))
                    .foregroundStyle(active ? SGM.green : SGM.textMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                Circle()
                    .fill(active ? SGM.green : .clear)
                    .frame(width: 4, height: 4)
            }
            .frame(width: 58, height: 58)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
    }
}
