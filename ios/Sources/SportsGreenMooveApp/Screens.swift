import SwiftUI

struct HomeView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        ScreenContainer {
            AppHeader()
            HeroPanel {
                appState.selectedTab = .greenList
            }
            StatsRow()
            SectionTitle("Semaine a venir")
            TripList(trips: appState.trips)
        }
        .navigationTitle("Accueil")
    }
}

struct GreenListView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        ScreenContainer {
            AppHeader()
            SectionTitle("Green-List")
            TripList(trips: appState.trips)

            if let ride = appState.activeRide {
                LiveRideCard(ride: ride)
            } else {
                PrimaryButton("Demarrer le suivi") {
                    Task {
                        if let trip = appState.trips.first {
                            await appState.startRide(tripId: trip.id)
                        }
                    }
                }
            }
        }
        .navigationTitle("Green-List")
    }
}

struct PublishTripView: View {
    var body: some View {
        ScreenContainer {
            AppHeader()
            SectionTitle("Publier votre trajet")
            FormRow(label: "Club", value: "Royal Ottignies")
            FormRow(label: "Categorie", value: "U8 Nationaux")
            FormRow(label: "Aller-retour", value: "Oui")
            FormRow(label: "Places disponibles", value: "2")
            FormRow(label: "Bagage", value: "Moyen")
            FormRow(label: "Suivi enfant", value: "Active")
            PrimaryButton("Publier") {}
        }
        .navigationTitle("Publier")
    }
}

struct SearchTripsView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        ScreenContainer {
            AppHeader()
            SectionTitle("Recherche")
            SearchFieldPlaceholder()
            TripList(trips: appState.trips)
        }
        .navigationTitle("Recherche")
    }
}

struct NotificationsView: View {
    var body: some View {
        ScreenContainer {
            AppHeader()
            SectionTitle("Notifications")
            FormRow(label: "Nouveau message", value: "Nadege")
            FormRow(label: "Depot confirme", value: "Kevin")
            FormRow(label: "Suivi", value: "Position OK")
        }
        .navigationTitle("Notifications")
    }
}

struct ImpactView: View {
    var body: some View {
        ScreenContainer {
            AppHeader()
            SectionTitle("Mon impact CO2")
            MetricCard(value: "12,4", label: "kg CO2 economises")
            MetricCard(value: "37 356", label: "utilisateurs en Wallonie")
        }
        .navigationTitle("CO2")
    }
}

struct RewardsView: View {
    var body: some View {
        ScreenContainer {
            AppHeader()
            SectionTitle("Recompenses")
            MetricCard(value: "45,40", label: "credit disponible")
            PrimaryButton("Configurer Stripe Connect") {}
        }
        .navigationTitle("Rewards")
    }
}

struct OptionsView: View {
    var body: some View {
        ScreenContainer {
            AppHeader()
            SectionTitle("Options")
            FormRow(label: "Mon profil", value: "Ouvrir")
            FormRow(label: "Enfants et consentements", value: "Ouvrir")
            FormRow(label: "Permissions de localisation", value: "Verifier")
            FormRow(label: "Moyens de paiement", value: "Stripe")
        }
        .navigationTitle("Options")
    }
}

private struct ScreenContainer<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SGMSpacing.x4) {
                content()
            }
            .padding(.bottom, SGMSpacing.x8)
        }
        .background(SGMColor.appBackground.ignoresSafeArea())
    }
}

private struct HeroPanel: View {
    var onOpenRide: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: SGMSpacing.x3) {
            Text("PROCHAINE COURSE")
                .font(.system(size: 12, weight: .black))
                .foregroundStyle(SGMColor.greenLight)
            Text("U8 NATIONAUX VS ROYAL OTTIGNIES SC")
                .font(.system(size: 28, weight: .black))
                .foregroundStyle(SGMColor.surface)
                .fixedSize(horizontal: false, vertical: true)
            Text("07 NOV - 16h45 - 2 passagers")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(SGMColor.surface.opacity(0.72))
            PrimaryButton("Voir le trajet", action: onOpenRide, fullWidth: false)
        }
        .padding(SGMSpacing.x5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SGMColor.greenDark)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .padding(.horizontal, SGMSpacing.x5)
    }
}

private struct StatsRow: View {
    var body: some View {
        HStack(spacing: SGMSpacing.x3) {
            MetricCard(value: "12,4", label: "kg CO2")
            MetricCard(value: "24", label: "trajets")
            MetricCard(value: "45,40", label: "EUR")
        }
        .padding(.horizontal, SGMSpacing.x5)
    }
}

private struct SectionTitle: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title.uppercased())
            .font(.system(size: 20, weight: .black))
            .foregroundStyle(SGMColor.textPrimary)
            .padding(.horizontal, SGMSpacing.x5)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct SearchFieldPlaceholder: View {
    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
            Text("Destination, club, evenement")
            Spacer()
        }
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(SGMColor.textMuted)
        .padding(SGMSpacing.x4)
        .background(SGMColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .padding(.horizontal, SGMSpacing.x5)
    }
}

private struct TripList: View {
    let trips: [TripSummary]

    var body: some View {
        VStack(spacing: SGMSpacing.x3) {
            ForEach(trips) { trip in
                TripCard(trip: trip)
            }
        }
        .padding(.horizontal, SGMSpacing.x5)
    }
}

private struct TripCard: View {
    let trip: TripSummary

    var body: some View {
        VStack(alignment: .leading, spacing: SGMSpacing.x3) {
            HStack {
                Text(trip.category.uppercased())
                    .foregroundStyle(SGMColor.green)
                    .font(.system(size: 11, weight: .black))
                Spacer()
                Text(trip.departureLabel)
                    .foregroundStyle(SGMColor.textMuted)
                    .font(.system(size: 12, weight: .semibold))
            }

            Text(trip.title)
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(SGMColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Text(trip.club)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(SGMColor.textSecondary)

            ForEach(trip.reasons.prefix(3), id: \.self) { reason in
                Text(reason)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(SGMColor.textSecondary)
            }
        }
        .padding(SGMSpacing.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SGMColor.card)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct LiveRideCard: View {
    let ride: LiveRideSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: SGMSpacing.x2) {
            Text("SUIVI EN DIRECT")
                .font(.system(size: 18, weight: .black))
                .foregroundStyle(SGMColor.textPrimary)
            Text(ride.etaLabel)
                .font(.system(size: 14, weight: .bold))
            Text("Vehicule: \(ride.vehicleLastUpdateLabel)")
            if let childLastUpdateLabel = ride.childLastUpdateLabel {
                Text("Enfant: \(childLastUpdateLabel)")
            }
            if ride.stale {
                Text("Position a verifier")
                    .foregroundStyle(SGMColor.red)
            }
        }
        .padding(SGMSpacing.x4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SGMColor.card)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.horizontal, SGMSpacing.x5)
    }
}

private struct MetricCard: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: SGMSpacing.x1) {
            Text(value)
                .font(.system(size: 28, weight: .black))
                .foregroundStyle(SGMColor.green)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(SGMColor.textMuted)
                .lineLimit(2)
                .multilineTextAlignment(.center)
        }
        .padding(SGMSpacing.x3)
        .frame(maxWidth: .infinity)
        .background(SGMColor.card)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct FormRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(SGMColor.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(SGMColor.green)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .padding(SGMSpacing.x4)
        .background(SGMColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .padding(.horizontal, SGMSpacing.x5)
    }
}

private struct PrimaryButton: View {
    let title: String
    var action: () -> Void
    var fullWidth = true

    init(_ title: String, action: @escaping () -> Void, fullWidth: Bool = true) {
        self.title = title
        self.action = action
        self.fullWidth = fullWidth
    }

    var body: some View {
        Button(action: action) {
            Text(title.uppercased())
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(SGMColor.surface)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .frame(maxWidth: fullWidth ? .infinity : nil)
                .frame(height: 48)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, fullWidth ? SGMSpacing.x5 : 0)
        .background(SGMColor.green)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
