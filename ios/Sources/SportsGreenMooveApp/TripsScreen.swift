import SwiftUI

struct TripsScreen: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = "upcoming"

    private let trips = [
        TripRow("Football", "U8 NATIONAUX VS ROYAL OTTIGNIES SC", "Mar 07 Nov", "16h45", "5.2 km", "2 places", ["IB", "NT"], "upcoming"),
        TripRow("Football", "ENTRAÎNEMENT U8 — GROUPE B", "Jeu 10 Nov", "18h00", "4.8 km", "2 places", ["NC"], "upcoming"),
        TripRow("Football", "U8 VS FOOTBALL CLUB DE BRUGES", "Sam 14 Nov", "10h00", "8.1 km", "3 places", ["IB", "NT", "JC"], "upcoming"),
        TripRow("Football", "ENTRAÎNEMENT U8 — GROUPE A", "Lun 24 Oct", "17h30", "4.8 km", "2 places", ["IB"], "past")
    ]

    var body: some View {
        SGMScreen {
            TripsHeader()
            TripsMonthNav()
            TripsTabs(selected: selectedTab) { selectedTab = $0 }
            VStack(spacing: 8) {
                ForEach(visibleTrips) { trip in
                    SGMTripCard(
                        sport: trip.sport,
                        title: trip.title,
                        date: trip.date,
                        time: trip.time,
                        distance: trip.distance,
                        seats: trip.seats,
                        passengers: trip.passengers
                    ) {
                        Task {
                            await appState.startRide(tripId: appState.trips.first?.id ?? "trip-u8-royal")
                        }
                    }
                }
                if selectedTab == "pending" {
                    PendingRequestsCard()
                }
            }
            .padding(.horizontal, SGMSpace.padScreen)
        }
    }

    private var visibleTrips: [TripRow] {
        trips.filter { $0.status == (selectedTab == "pending" ? "upcoming" : selectedTab) }
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
        .padding(.top, 34)
        .padding(.bottom, 16)
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
        .padding(.bottom, 2)
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

private struct TripRow: Identifiable {
    let id = UUID()
    let sport: String
    let title: String
    let date: String
    let time: String
    let distance: String
    let seats: String
    let passengers: [String]
    let status: String

    init(_ sport: String, _ title: String, _ date: String, _ time: String, _ distance: String, _ seats: String, _ passengers: [String], _ status: String) {
        self.sport = sport
        self.title = title
        self.date = date
        self.time = time
        self.distance = distance
        self.seats = seats
        self.passengers = passengers
        self.status = status
    }
}
