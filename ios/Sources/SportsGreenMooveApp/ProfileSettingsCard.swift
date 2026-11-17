import SwiftUI

struct ProfileSettingsCard: View {
    @Environment(AppState.self) private var appState
    var body: some View {
        VStack(spacing: 0) {
            ProfileSettingRow(icon: .groups, title: "Mon club",
                value: appState.clubSummaries.first(where: \.isMember)?.name ?? "Aucun club lié") { appState.openOverlay(.groups) }
            divider
            ProfileSettingRow(icon: .award, title: "Paiements", value: "Stripe") { appState.openOverlay(.payments) }
            divider
            if let access = appState.accountAccess {
                ProfileCityEntry(access: access, gateway: appState.firebase).id(access.context.id)
            }
            divider
            ProfileSettingRow(icon: .bell, title: "Notifications") { appState.openOverlay(.options) }
            divider
            ProfileSettingRow(icon: .settings, title: "Paramètres") { appState.openOverlay(.options) }
        }.background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
    private var divider: some View { Rectangle().fill(SGM.border).frame(height: 1).padding(.leading, 46) }
}

struct ProfileSettingRow: View {
    let icon: SGMIcon
    let title: String
    var value = ""
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                SGMIconView(icon: icon, size: 18, color: SGM.textMuted)
                Text(title).font(.sgmBody(14, weight: .semibold)).foregroundStyle(SGM.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                if !value.isEmpty {
                    Text(value).font(.sgmBody(13, weight: .medium)).foregroundStyle(SGM.textMuted)
                        .multilineTextAlignment(.trailing).fixedSize(horizontal: false, vertical: true)
                }
                SGMIconView(icon: .chevronRight, size: 13, color: SGM.textMuted)
            }.frame(maxWidth: .infinity, minHeight: 18, alignment: .leading)
                .padding(.horizontal, 16).padding(.vertical, 13).contentShape(Rectangle())
        }.buttonStyle(.plain)
    }
}
