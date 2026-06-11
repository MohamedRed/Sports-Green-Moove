import SwiftUI

struct SearchScreen: View {
    var body: some View {
        OverlayListScreen(title: "RECHERCHE") {
            OverlaySearchField()
            OverlayCard(title: "U8 NATIONAUX VS ROYAL OTTIGNIES SC", subtitle: "Royal Ottignies", meta: "2 places · 2,50 EUR · +6 min détour")
            OverlayCard(title: "ENTRAÎNEMENT U8 GROUPE B", subtitle: "Collège du Biéreau", meta: "1 place · Gratuit · Même club")
        }
    }
}

struct GroupsScreen: View {
    var body: some View {
        OverlayListScreen(title: "GROUPES") {
            OverlayCard(title: "Royal Ottignies", subtitle: "U8 Nationaux · 18 membres", meta: "OUVRIR")
            OverlayCard(title: "Collège du Biéreau", subtitle: "Parents · Trajets école", meta: "REJOINDRE")
        }
    }
}

struct ImpactScreen: View {
    var body: some View {
        OverlayListScreen(title: "MON IMPACT CO₂") {
            OverlayHeroMetric(value: "12.4", label: "kg CO₂ économisés", accent: SGM.green)
            OverlayProgressRow(title: "Wallonie", value: "37 356 kg", progress: 0.74)
            OverlayProgressRow(title: "Flandre", value: "45 704 kg", progress: 0.58)
            OverlayProgressRow(title: "Bruxelles", value: "20 998 kg", progress: 0.42)
        }
    }
}

struct RewardsScreen: View {
    var body: some View {
        OverlayListScreen(title: "RÉCOMPENSES") {
            OverlayHeroMetric(value: "7.50€", label: "Solde disponible", accent: SGM.orange)
            OverlayProgressRow(title: "Prochain palier", value: "62%", progress: 0.62)
            OverlayCard(title: "Trajet partagé", subtitle: "U8 Nationaux", meta: "+1.20€")
            OverlayCard(title: "Bonus CO₂", subtitle: "Wallonie", meta: "+0.40€")
        }
    }
}

struct OptionsScreen: View {
    var body: some View {
        OverlayListScreen(title: "OPTIONS") {
            OverlayCard(title: "Mon profil", subtitle: "Olivier", meta: "OUVRIR")
            OverlayCard(title: "Enfants et consentements", subtitle: "2 enfants", meta: "OUVRIR")
            OverlayCard(title: "Localisation", subtitle: "Permissions", meta: "ACTIVÉE")
            OverlayCard(title: "Paiements", subtitle: "Stripe Connect", meta: "CONFIGURER")
        }
    }
}

struct RideMonitorScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        OverlayListScreen(title: "COURSE ACTIVE") {
            OverlayHeroMetric(
                value: appState.activeRide?.etaLabel ?? "16h38",
                label: "Véhicule · \(appState.activeRide?.vehicleLastUpdateLabel ?? "Il y a 12 s")",
                accent: SGM.greenLight
            )
            OverlayCard(title: "Enfant", subtitle: appState.activeRide?.childLastUpdateLabel ?? "Il y a 35 s", meta: "POSITION OK")
            OverlayCard(title: "Urgence", subtitle: "Contact parent disponible", meta: "APPELER")
        }
    }
}

private struct OverlayListScreen<Content: View>: View {
    let title: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        SGMScreen {
            SGMTopBar(title: title, showsBack: true)
            VStack(spacing: 10) {
                content()
            }
            .padding(.horizontal, SGMSpace.padScreen)
        }
    }
}

private struct OverlaySearchField: View {
    var body: some View {
        HStack(spacing: 10) {
            SGMIconView(icon: .search, size: 16, color: SGM.textMuted)
            Text("Destination, club, événement")
                .font(.sgmBody(14, weight: .semibold))
                .foregroundStyle(SGM.textMuted)
            Spacer()
        }
        .padding(16)
        .background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct OverlayCard: View {
    let title: String
    let subtitle: String
    let meta: String

    var body: some View {
        HStack(spacing: 12) {
            SGMAvatar(initials: String(title.prefix(2)), size: 38, muted: true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.sgmBody(14, weight: .bold))
                    .foregroundStyle(SGM.textPrimary)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.sgmBody(12, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
            }
            Spacer()
            Text(meta)
                .font(.sgmBody(11, weight: .bold))
                .foregroundStyle(SGM.green)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .padding(14)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct OverlayHeroMetric: View {
    let value: String
    let label: String
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(value)
                .font(.sgmDisplay(56))
                .foregroundStyle(accent)
                .lineLimit(1)
                .minimumScaleFactor(0.58)
            Text(label)
                .font(.sgmBody(14, weight: .bold))
                .foregroundStyle(SGM.textOnGreen.opacity(0.72))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(SGM.heroGradient, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(SGMGridTexture())
    }
}

private struct OverlayProgressRow: View {
    let title: String
    let value: String
    let progress: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.sgmBody(14, weight: .bold))
                    .foregroundStyle(SGM.textPrimary)
                Spacer()
                Text(value)
                    .font(.sgmBody(12, weight: .bold))
                    .foregroundStyle(SGM.textMuted)
            }
            SGMProgressBar(progress: progress)
        }
        .padding(14)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}
