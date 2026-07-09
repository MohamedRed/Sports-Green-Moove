import SwiftUI

struct ProfileScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        SGMScreen(spacing: 0) {
            SGMTopBar(title: "MON PROFIL")
            ProfileIdentity()
            ProfileRoleSelector()
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

private struct ProfileRoleSelector: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                RoleChip("Parent", role: .parent)
                RoleChip("Conducteur", role: .driver)
            }
            HStack(spacing: 6) {
                RoleChip("Enfant", role: .child)
                RoleChip("Club manager", role: .clubManager)
            }
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.bottom, 14)
    }
}

private struct RoleChip: View {
    @Environment(AppState.self) private var appState
    let title: String
    let role: AppRole

    init(_ title: String, role: AppRole) {
        self.title = title
        self.role = role
    }

    var body: some View {
        SGMChip(text: title, selected: appState.selectedRole == role) {
            appState.selectedRole = role
            Task { await appState.refreshAppData() }
        }
    }
}

private struct ProfileIdentity: View {
    @Environment(AppState.self) private var appState

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
                Text("Olivier · \(primaryClubLabel)")
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

    private var primaryClubLabel: String {
        appState.clubSummaries.first(where: \.isMember)?.name ?? "Aucun club lié"
    }
}

private struct ProfileImpactCard: View {
    @Environment(AppState.self) private var appState
    let action: () -> Void

    var body: some View {
        let summary = appState.impactSummary
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
                            Text(profileKgValue(summary.totalCo2Kg))
                                .font(.sgmDisplay(56))
                                .foregroundStyle(SGM.green)
                            Text("kg CO₂ économisés")
                                .font(.sgmBody(13, weight: .semibold))
                                .foregroundStyle(SGM.textOnGreen.opacity(0.6))
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(summary.sharedDistanceKm) km partagés")
                            Text("\(summary.rideCount) trajets clôturés")
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
    @Environment(AppState.self) private var appState
    let action: () -> Void

    var body: some View {
        let summary = appState.rewardSummary
        Button(action: action) {
            VStack(spacing: 10) {
                HStack {
                    SGMIconView(icon: .award, size: 22, color: SGM.orange)
                    Text("RÉCOMPENSES")
                        .font(.sgmDisplay(18))
                        .tracking(.sgmWide(for: 18))
                        .foregroundStyle(SGM.textPrimary)
                    Spacer()
                    Text(profileMoneyLabel(summary.balanceCents))
                        .font(.sgmDisplay(24))
                        .foregroundStyle(SGM.orange)
                }
                SGMProgressBar(progress: CGFloat(summary.progress))
                HStack {
                    Text("Prochain palier à \(profileMoneyLabel(summary.nextTierCents))")
                    Spacer()
                    Text(profilePercentLabel(summary.progress))
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

    private var rows: [ProfileSetting] {
        [
            ProfileSetting(.groups, "Mon club", appState.clubSummaries.first(where: \.isMember)?.name ?? "Aucun club lié", AppOverlay.groups),
            ProfileSetting(.award, "Paiements", "Stripe", AppOverlay.payments),
            ProfileSetting(.location, "Ma ville", "Wavre, Belgique", AppOverlay.options),
            ProfileSetting(.bell, "Notifications", "Activées", AppOverlay.options),
            ProfileSetting(.settings, "Paramètres", "", AppOverlay.options)
        ]
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

private func profileKgValue(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "fr_FR")
    formatter.minimumFractionDigits = 1
    formatter.maximumFractionDigits = 1
    return formatter.string(from: NSNumber(value: value)) ?? String(format: "%.1f", value)
}

private func profileMoneyLabel(_ cents: Int) -> String {
    let sign = cents < 0 ? "-" : ""
    let absolute = abs(cents)
    return "\(sign)\(absolute / 100),\(String(format: "%02d", absolute % 100))€"
}

private func profilePercentLabel(_ progress: Double) -> String {
    "\(Int(min(1, max(0, progress)) * 100))%"
}
