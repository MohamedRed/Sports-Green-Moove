import SwiftUI

struct TripsScreen: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = "upcoming"

    var body: some View {
        SGMScreen(spacing: 0) {
            TripsHeader()
            TripsMonthNav()
            TripsTabs(
                selected: selectedTab,
                pendingCount: appState.driverBookingRequests.filter { $0.status == "requested" }.count
            ) { selectedTab = $0 }
            VStack(spacing: 8) {
                if selectedTab == "pending" {
                    BookingRequestsList(requests: appState.driverBookingRequests)
                } else {
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
                }
            }
            .padding(.horizontal, SGMSpace.padScreen)
            .padding(.top, 8)
        }
    }

    private var visibleTrips: [TripSummary] {
        appState.trips.filter { $0.status.rawValue == selectedTab }
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
    let pendingCount: Int
    var onSelect: (String) -> Void

    var body: some View {
        HStack(spacing: 6) {
            SGMChip(text: "À venir", selected: selected == "upcoming") { onSelect("upcoming") }
            SGMChip(text: "Passés", selected: selected == "past") { onSelect("past") }
            SGMChip(
                text: "En attente",
                selected: selected == "pending",
                badge: pendingCount > 0 ? "\(pendingCount)" : nil
            ) { onSelect("pending") }
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.bottom, 8)
    }
}

private struct BookingRequestsList: View {
    let requests: [BookingRequestSummary]

    var body: some View {
        if requests.isEmpty {
            EmptyBookingRequestsCard()
        } else {
            ForEach(requests) { request in
                BookingRequestCard(request: request)
            }
        }
    }
}

private struct EmptyBookingRequestsCard: View {
    var body: some View {
        Text("Aucune demande conducteur en attente.")
            .font(.sgmBody(13, weight: .semibold))
            .foregroundStyle(SGM.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct BookingRequestCard: View {
    @Environment(AppState.self) private var appState
    let request: BookingRequestSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(request.status.uppercased())
                    .font(.sgmBody(11, weight: .bold))
                    .tracking(.sgmWider(for: 11))
                    .foregroundStyle(SGM.green)
                Spacer()
                Text("\(request.dateLabel) · \(request.timeLabel)")
                    .font(.sgmBody(11, weight: .semibold))
                    .foregroundStyle(SGM.textMuted)
            }
            Text(request.title)
                .font(.sgmDisplay(17))
                .tracking(.sgmWide(for: 17))
                .foregroundStyle(SGM.textPrimary)
                .lineLimit(1)
            Text("\(request.seats) place\(request.seats > 1 ? "s" : "") · \(request.priceLabel) · Parent \(request.parentUserId.suffix(6))")
                .font(.sgmBody(12, weight: .semibold))
                .foregroundStyle(SGM.textMuted)
                .lineLimit(1)
            if let note = request.note, !note.isEmpty {
                Text(note)
                    .font(.sgmBody(12))
                    .foregroundStyle(SGM.textSecondary)
                    .lineLimit(2)
            }
            if request.status == "requested" {
                SGMButton(title: "APPROUVER", full: false) {
                    Task { await appState.approveBooking(request) }
                }
            }
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
