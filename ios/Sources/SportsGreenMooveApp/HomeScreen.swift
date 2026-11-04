import SwiftUI

struct HomeScreen: View {
    @Environment(AppState.self) private var appState
    let access: AccountAccess

    var body: some View {
        SGMScreen(spacing: 0, testID: UITestIdentifier.homeScreen) {
            HomeHeader()
            if access.context.grantedRoles.contains(.child) {
                EmergencyContactEntry(access: access).padding(.horizontal, SGMSpace.padScreen)
            }
            let nextTrip = appState.trips.first
            HomeHeroCard(trip: nextTrip) {
                guard let nextTrip else { return }
                Task { await appState.handleTripAction(trip: nextTrip, access: access) }
            }
            .disabled(nextTrip == nil || appState.tripActionBusy)
            HomeStatsRow(summary: appState.impactSummary)
            SGMSectionLabel("SEMAINE À VENIR", action: "Tout voir") {
                appState.selectTab(.trips)
            }
            VStack(spacing: 8) {
                ForEach(appState.trips.prefix(2)) { trip in
                    SGMTripCard(
                        sport: trip.sport,
                        title: trip.title,
                        date: trip.dateLabel,
                        time: trip.timeLabel,
                        distance: trip.distanceLabel,
                        seats: trip.seatsLabel,
                        passengers: trip.passengerInitials
                    ) {
                        Task { await appState.handleTripAction(trip: trip, access: access) }
                    }
                    .disabled(appState.tripActionBusy)
                }
                if appState.trips.isEmpty {
                    HomeEmptyTrips()
                }
            }
            .padding(.horizontal, SGMSpace.padScreen)

            SGMSectionLabel("IMPACT ÉCOLOGIQUE")
            HomeImpactPreview(summary: appState.impactSummary)
                .padding(.horizontal, SGMSpace.padScreen)
        }
    }
}

private struct HomeHeader: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Bonjour")
                        .font(.sgmBody(15, weight: .bold))
                        .foregroundStyle(SGM.textPrimary)
                    if let name = appState.session?.displayName, !name.isEmpty {
                        Text(name)
                            .font(.sgmBody(15, weight: .bold))
                            .foregroundStyle(SGM.green)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    TimelineView(.periodic(from: .now, by: 60)) { context in
                        Text(context.date, format: .dateTime.weekday(.wide).day().month(.wide).year().locale(Locale(identifier: "fr_BE")))
                            .font(.sgmBody(11, weight: .medium))
                            .foregroundStyle(SGM.textMuted)
                    }
                }
                Spacer()
                SGMThemeButton()
            }
            Wordmark()
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.top, 10)
        .padding(.bottom, 14)
    }
}

private struct HomeHeroCard: View {
    let trip: TripSummary?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                SGM.homeHeroGradient
                SGMGridTexture(spacing: 28)

                VStack(alignment: .leading, spacing: 0) {
                    Text("PROCHAINE COURSE")
                        .font(.sgmDisplay(11))
                        .tracking(.sgmWider(for: 11))
                        .foregroundStyle(SGM.textOnGreen)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 3)
                        .background(SGM.green, in: Capsule())

                    Spacer()

                    Text(trip?.title ?? "AUCUN TRAJET PUBLIÉ")
                        .font(.sgmDisplay(18))
                        .tracking(.sgmWide(for: 18))
                        .foregroundStyle(SGM.textOnGreen)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)

                    HStack(spacing: 10) {
                        Text(trip?.departureLabel ?? "DATE À CONFIRMER")
                            .font(.sgmBody(11, weight: .bold))
                            .foregroundStyle(SGM.greenLight)
                        Text("\(trip?.distanceLabel ?? "Distance à confirmer") · \(trip?.seatsLabel ?? "0 place")")
                            .font(.sgmBody(11, weight: .medium))
                            .foregroundStyle(SGM.textOnGreen.opacity(0.62))
                    }
                    .padding(.top, 5)
                }
                .padding(16)
            }
            .frame(height: 172)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.bottom, 16)
    }
}

private struct HomeEmptyTrips: View {
    var body: some View {
        Text("Aucun trajet publié pour le moment.")
            .font(.sgmBody(13, weight: .semibold))
            .foregroundStyle(SGM.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct HomeStatsRow: View {
    let summary: ImpactSummary

    var body: some View {
        HStack(spacing: 8) {
            SGMStatTile(value: homeKgValue(summary.totalCo2Kg), unit: "kg", label: "CO₂ économisé")
            SGMStatTile(value: "\(summary.rideCount)", unit: "trajets", label: "Partagés", accent: SGM.orange)
            SGMStatTile(value: "\(summary.sharedDistanceKm)", unit: "km", label: "Parcourus")
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.bottom, 16)
    }
}

private struct HomeImpactPreview: View {
    let summary: ImpactSummary

    var body: some View {
        HStack(spacing: 14) {
            SGMIconView(icon: .leaf, size: 22, color: SGM.green)
                .frame(width: 46, height: 46)
                .background(SGM.green.opacity(0.16), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text("CO₂ EN TEMPS RÉEL")
                    .font(.sgmDisplay(20))
                    .tracking(.sgmWide(for: 20))
                    .foregroundStyle(SGM.textOnGreen)
                Text("\(homeKgValue(summary.totalCo2Kg)) kg économisés · \(summary.sharedDistanceKm) km partagés")
                    .font(.sgmBody(12, weight: .medium))
                    .foregroundStyle(SGM.textOnGreen.opacity(0.68))
            }
            Spacer()
        }
        .padding(16)
        .background(SGM.heroGradient, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(SGMGridTexture())
    }
}

private func homeKgValue(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "fr_FR")
    formatter.minimumFractionDigits = 1
    formatter.maximumFractionDigits = 1
    return formatter.string(from: NSNumber(value: value)) ?? String(format: "%.1f", value)
}
