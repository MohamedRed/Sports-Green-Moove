import SwiftUI

struct ProfileScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        SGMScreen(spacing: 0) {
            SGMTopBar(title: "MON PROFIL")
            ProfileIdentity()
            ProfileImpactCard {
                appState.openOverlay(.impact)
            }
            ProfileRewardsCard {
                appState.openOverlay(.rewards)
            }
            SGMSectionLabel("PARAMÈTRES")
            ProfileSettingsCard()
                .padding(.horizontal, SGMSpace.padScreen)
            SGMButton(title: "SE DÉCONNECTER", variant: .ghost) {}
                .padding(.horizontal, SGMSpace.padScreen)
                .padding(.top, 4)
        }
    }
}

private struct ProfileIdentity: View {
    var body: some View {
        VStack(spacing: 10) {
            Text("OB")
                .font(.sgmDisplay(30))
                .tracking(.sgmWide(for: 30))
                .foregroundStyle(SGM.textOnGreen)
                .frame(width: 80, height: 80)
                .background(
                    LinearGradient(colors: [SGM.green, SGM.greenDark], startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: Circle()
                )
                .shadow(color: SGM.green.opacity(0.24), radius: 10, y: 4)

            VStack(spacing: 2) {
                Text("BAKOMBA-NZOLUVONDA")
                    .font(.sgmDisplay(22))
                    .tracking(.sgmWide(for: 22))
                    .foregroundStyle(SGM.textPrimary)
                Text("Olivier · Collège du Biéreau")
                    .font(.sgmBody(13, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
            }

            HStack(spacing: 6) {
                ProfilePill("GREEN-MOOVER", selected: false)
                ProfilePill("U8 NATIONAUX", selected: true)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.top, 16)
        .padding(.bottom, 10)
    }
}

private struct ProfileImpactCard: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .leading) {
                SGM.heroGradient
                SGMGridTexture()
                VStack(alignment: .leading, spacing: 6) {
                    Text("MON IMPACT CO₂")
                        .font(.sgmBody(11, weight: .bold))
                        .tracking(.sgmWider(for: 11))
                        .foregroundStyle(SGM.textOnGreen.opacity(0.5))
                    HStack(alignment: .bottom, spacing: 24) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("12.4")
                                .font(.sgmDisplay(56))
                                .foregroundStyle(SGM.green)
                            Text("kg CO₂ économisés")
                                .font(.sgmBody(13, weight: .semibold))
                                .foregroundStyle(SGM.textOnGreen.opacity(0.6))
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text("≈ 847 km parcourus")
                            Text("24 trajets partagés")
                            Text("Rang #47 Belgique")
                        }
                        .font(.sgmBody(12))
                        .foregroundStyle(SGM.textOnGreen.opacity(0.72))
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 18)
            }
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, SGMSpace.padScreen)
    }
}

private struct ProfileRewardsCard: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 10) {
                HStack {
                    SGMIconView(icon: .award, size: 22, color: SGM.orange)
                    Text("RÉCOMPENSES")
                        .font(.sgmDisplay(18))
                        .tracking(.sgmWide(for: 18))
                        .foregroundStyle(SGM.textPrimary)
                    Spacer()
                    Text("7.50€")
                        .font(.sgmDisplay(24))
                        .foregroundStyle(SGM.orange)
                }
                SGMProgressBar(progress: 0.62)
                HStack {
                    Text("Prochain palier à 10€")
                    Spacer()
                    Text("62%")
                }
                .font(.sgmBody(11, weight: .medium))
                .foregroundStyle(SGM.textMuted)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(SGM.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.top, 6)
    }
}

private struct ProfileSettingsCard: View {
    @Environment(AppState.self) private var appState

    private let rows = [
        ProfileSetting(.groups, "Mon club", "Collège du Biéreau", AppOverlay.groups),
        ProfileSetting(.location, "Ma ville", "Wavre, Belgique", AppOverlay.options),
        ProfileSetting(.bell, "Notifications", "Activées", AppOverlay.options),
        ProfileSetting(.settings, "Paramètres", "", AppOverlay.options)
    ]

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                Button {
                    appState.openOverlay(row.destination)
                } label: {
                    HStack(spacing: 12) {
                        SGMIconView(icon: row.icon, size: 18, color: SGM.textMuted)
                        Text(row.label)
                            .font(.sgmBody(14, weight: .semibold))
                            .foregroundStyle(SGM.textPrimary)
                        Spacer()
                        if !row.value.isEmpty {
                            Text(row.value)
                                .font(.sgmBody(13, weight: .medium))
                                .foregroundStyle(SGM.textMuted)
                        }
                        SGMIconView(icon: .chevronRight, size: 13, color: SGM.textMuted)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                }
                .buttonStyle(.plain)
                if index < rows.count - 1 {
                    Rectangle()
                        .fill(SGM.border)
                        .frame(height: 1)
                        .padding(.leading, 46)
                }
            }
        }
        .background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct ProfilePill: View {
    let text: String
    let selected: Bool

    init(_ text: String, selected: Bool) {
        self.text = text
        self.selected = selected
    }

    var body: some View {
        Text(text)
            .font(.sgmBody(11, weight: .bold))
            .tracking(.sgmWide(for: 11))
            .foregroundStyle(selected ? SGM.textOnGreen : SGM.green)
            .padding(.horizontal, 12)
            .padding(.vertical, 3)
            .background(selected ? SGM.green : SGM.bgCard, in: Capsule())
            .overlay(Capsule().stroke(selected ? .clear : SGM.border, lineWidth: 1))
    }
}

private struct ProfileSetting: Identifiable {
    let id = UUID()
    let icon: SGMIcon
    let label: String
    let value: String
    let destination: AppOverlay

    init(_ icon: SGMIcon, _ label: String, _ value: String, _ destination: AppOverlay) {
        self.icon = icon
        self.label = label
        self.value = value
        self.destination = destination
    }
}
