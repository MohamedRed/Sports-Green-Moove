import SwiftUI

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

struct RideMonitorScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        OverlayListScreen(title: "COURSE ACTIVE") {
            OverlayHeroMetric(
                value: appState.activeRide?.etaLabel ?? "16h38",
                label: "Véhicule · \(appState.activeRide?.vehicleLastUpdateLabel ?? "Il y a 12 s")",
                accent: SGM.greenLight
            )
            OverlayCard(
                title: "Véhicule",
                subtitle: appState.activeRide?.vehicleLastUpdateLabel ?? "En attente GPS",
                meta: appState.activeRide?.stale == true ? "À VÉRIFIER" : "LIVE"
            )
            OverlayCard(title: "Enfant", subtitle: appState.activeRide?.childLastUpdateLabel ?? "Non disponible", meta: "SUIVI")
            if let ride = appState.activeRide {
                RidePassengerControls(ride: ride)
                RideEndControls()
            }
            OverlayCard(title: "Urgence", subtitle: "Contact parent disponible", meta: "APPELER")
        }
    }
}

private struct RidePassengerControls: View {
    @Environment(AppState.self) private var appState
    let ride: LiveRideSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("PASSAGERS")
                .font(.sgmDisplay(17))
                .tracking(.sgmWide(for: 17))
                .foregroundStyle(SGM.textPrimary)
            if ride.passengers.isEmpty {
                Text("Aucun passager approuvé attaché à cette course.")
                    .font(.sgmBody(12, weight: .bold))
                    .foregroundStyle(SGM.textMuted)
            } else {
                ForEach(ride.passengers) { passenger in
                    RidePassengerRow(passenger: passenger)
                }
            }
        }
        .padding(14)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct RidePassengerRow: View {
    @Environment(AppState.self) private var appState
    let passenger: RidePassengerStatus

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                SGMAvatar(initials: passenger.label, size: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(passenger.label)
                        .font(.sgmBody(14, weight: .bold))
                        .foregroundStyle(SGM.textPrimary)
                    Text("Pickup \(passenger.pickupStatus.statusLabel) · Dropoff \(passenger.dropoffStatus.statusLabel)")
                        .font(.sgmBody(12, weight: .bold))
                        .foregroundStyle(SGM.textMuted)
                }
            }
            HStack(spacing: 8) {
                SGMButton(
                    title: "PICKUP",
                    variant: passenger.pickupStatus == "pickedUp" ? .ghost : .primary,
                    action: { Task { await appState.markPickup(passenger) } }
                )
                SGMButton(
                    title: "DROPOFF",
                    variant: passenger.dropoffStatus == "droppedOff" ? .ghost : .primary,
                    action: { Task { await appState.markDropoff(passenger) } }
                )
            }
        }
    }
}

private struct RideEndControls: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("FIN DE COURSE")
                .font(.sgmDisplay(17))
                .tracking(.sgmWide(for: 17))
                .foregroundStyle(SGM.orange)
            Text("Arrête le suivi Radar et le secours GPS Firebase, puis clôture les réservations attachées.")
                .font(.sgmBody(12, weight: .bold))
                .foregroundStyle(SGM.textSecondary)
            SGMButton(title: "TERMINER LA COURSE", variant: .orange) {
                Task { await appState.endActiveRide() }
            }
        }
        .padding(14)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private extension String {
    var statusLabel: String {
        switch self {
        case "pickedUp", "droppedOff": "validé"
        default: "à confirmer"
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
