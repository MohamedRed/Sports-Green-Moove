import SwiftUI

struct HomeScreen: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        SGMScreen {
            HomeHeader()
            HomeHeroCard {
                Task {
                    await appState.startRide(tripId: appState.trips.first?.id ?? "trip-u8-royal")
                }
            }
            HomeStatsRow()
            SGMSectionLabel("SEMAINE À VENIR", action: "Tout voir") {
                appState.selectTab(.trips)
            }
            VStack(spacing: 8) {
                SGMTripCard(
                    sport: "Football",
                    title: "U8 NATIONAUX VS ROYAL OTTIGNIES SC",
                    date: "Mar 07 Nov",
                    time: "16h45",
                    distance: "5.2 km",
                    seats: "2 places",
                    passengers: ["IB", "NT"]
                )
                SGMTripCard(
                    sport: "Football",
                    title: "ENTRAÎNEMENT U8 — GROUPE B",
                    date: "Jeu 10 Nov",
                    time: "18h00",
                    distance: "4.8 km",
                    seats: "2 places",
                    passengers: ["NC"]
                )
            }
            .padding(.horizontal, SGMSpace.padScreen)

            SGMSectionLabel("IMPACT ÉCOLOGIQUE")
            HomeImpactPreview()
                .padding(.horizontal, SGMSpace.padScreen)
        }
    }
}

private struct HomeHeader: View {
    var body: some View {
        VStack(spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 0) {
                        Text("Bonjour, ")
                            .font(.sgmBodyBase.weight(.bold))
                            .foregroundStyle(SGM.textPrimary)
                        Text("Olivier")
                            .font(.sgmBodyBase.weight(.bold))
                            .foregroundStyle(SGM.green)
                    }
                    Text("Mardi 07 Novembre 2022")
                        .font(.sgmBody(11, weight: .medium))
                        .foregroundStyle(SGM.textMuted)
                }
                Spacer()
                SGMThemeButton()
            }
            Wordmark()
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.top, 10)
        .padding(.bottom, 2)
    }
}

private struct HomeHeroCard: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                SGM.heroGradient
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

                    Text("U8 NATIONAUX VS ROYAL OTTIGNIES SC")
                        .font(.sgmDisplay(18))
                        .tracking(.sgmWide(for: 18))
                        .foregroundStyle(SGM.textOnGreen)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)

                    HStack(spacing: 10) {
                        Text("07 NOV · 16h45")
                            .font(.sgmBody(11, weight: .bold))
                            .foregroundStyle(SGM.greenLight)
                        Text("5.2 km · 2 passagers")
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
    }
}

private struct HomeStatsRow: View {
    var body: some View {
        HStack(spacing: 8) {
            SGMStatTile(value: "12,4", unit: "kg", label: "CO₂ économisé")
            SGMStatTile(value: "24", unit: "trajets", label: "Partagés", accent: SGM.orange)
            SGMStatTile(value: "847", unit: "km", label: "Parcourus")
        }
        .padding(.horizontal, SGMSpace.padScreen)
    }
}

private struct HomeImpactPreview: View {
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
                Text("Wallonie · Flandre · Bruxelles")
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
