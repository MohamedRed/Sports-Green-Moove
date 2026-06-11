import SwiftUI

struct TripsScreen: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = "upcoming"

    var body: some View {
        SGMScreen(spacing: 0) {
            TripsHeader()
            TripsMonthNav()
            TripsTabs(selected: selectedTab) { selectedTab = $0 }
            VStack(spacing: 8) {
                ForEach(visibleTrips) { trip in
                    SGMTripCard(
                        sport: trip.sport,
                        title: trip.title,
                        date: trip.dateLabel,
                        time: trip.timeLabel,
                        distance: trip.distanceLabel,
                        seats: trip.seatsLabel,
                        passengers: trip.passengerInitials
                    ) {
                        Task {
                            await appState.handleTripAction(tripId: trip.id)
                        }
                    }
                }
                if selectedTab == "pending" {
                    PendingRequestsCard()
                }
            }
            .padding(.horizontal, SGMSpace.padScreen)
            .padding(.top, 8)
        }
    }

    private var visibleTrips: [TripSummary] {
        appState.trips.filter { $0.status.rawValue == (selectedTab == "pending" ? "upcoming" : selectedTab) }
    }
}

private struct TripsHeader: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        HStack(spacing: 12) {
            Text("MES TRAJETS")
                .font(.sgmDisplay(22))
                .tracking(.sgmWide(for: 22))
                .foregroundStyle(SGM.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            SGMCircleIconButton(icon: .search) {
                appState.openOverlay(.search)
            }
            SGMThemeButton()
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }
}

private struct TripsMonthNav: View {
    var body: some View {
        HStack {
            SGMCircleIconButton(icon: .chevronLeft, size: 32)
            Text("NOVEMBRE 2022")
                .font(.sgmDisplay(18))
                .tracking(.sgmWider(for: 18))
                .foregroundStyle(SGM.textPrimary)
                .frame(maxWidth: .infinity)
            SGMCircleIconButton(icon: .chevronRight, size: 32)
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.bottom, 12)
    }
}

private struct TripsTabs: View {
    let selected: String
    var onSelect: (String) -> Void

    var body: some View {
        HStack(spacing: 6) {
            SGMChip(text: "À venir", selected: selected == "upcoming") { onSelect("upcoming") }
            SGMChip(text: "Passés", selected: selected == "past") { onSelect("past") }
            SGMChip(text: "En attente", selected: selected == "pending", badge: "2") { onSelect("pending") }
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.bottom, 8)
    }
}

private struct PendingRequestsCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("DEMANDES EN ATTENTE")
                .font(.sgmDisplay(13))
                .tracking(.sgmWider(for: 13))
                .foregroundStyle(SGM.textPrimary)
            Text("Idriss BAMAKO · U8 vs Ottignies")
                .font(.sgmBody(13, weight: .bold))
                .foregroundStyle(SGM.textPrimary)
            Text("Kévin TOUSSAINT · U8 vs Ottignies")
                .font(.sgmBody(13, weight: .bold))
                .foregroundStyle(SGM.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous)
                .stroke(SGM.border, lineWidth: 1)
        )
    }
}
