import SwiftUI

struct ParentReservationsScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: ParentReservationState
    @State private var history = false
    @State private var selected: ParentReservation?
    init(access: AccountAccess, gateway: any ParentReservationGateway) {
        _state = State(initialValue: ParentReservationState(access: access, gateway: gateway))
    }
    var body: some View {
        SGMScreen(testID: "reservations.screen") {
            HStack {
                Text("MES RÉSERVATIONS").font(.sgmDisplay(22)).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                SGMCircleIconButton(icon: .search) { appState.openOverlay(.search) }
                Button { Task { await state.refresh() } } label: { Image(systemName: "arrow.clockwise").frame(width: 44, height: 44) }
                    .disabled(state.busy || !state.live).help("Actualiser").accessibilityLabel("Actualiser les réservations")
                    .accessibilityIdentifier("reservations.refresh")
            }.padding(.horizontal, SGMSpace.padScreen)
            if state.live {
                VStack(alignment: .leading, spacing: 16) {
                    Picker("Réservations", selection: $history) {
                        Text("En cours").tag(false)
                        Text("Historique").tag(true)
                    }.pickerStyle(.segmented).accessibilityIdentifier("reservations.sections")
                    if appState.activeRide != nil {
                        SGMButton(title: "SUIVRE LE TRAJET") { appState.openOverlay(.ride) }
                    }
                    if state.busy { ProgressView().accessibilityLabel("Vérification des réservations") }
                    if state.confirmation != nil {
                        Text("Réservation annulée.").accessibilityIdentifier("reservations.confirmed")
                    }
                    if let error = state.error { Text(error).accessibilityIdentifier("reservations.error") }
                    if state.requiresRefresh {
                        Button("Actualiser les réservations") { Task { await state.refresh() } }
                            .disabled(state.busy).frame(minHeight: 44).accessibilityIdentifier("reservations.resolve")
                    }
                    if state.loaded && visible.isEmpty && !state.hasMore { Text("Aucune réservation.") }
                    ForEach(visible) { row in
                        ParentReservationRow(row: row, canCancel: state.canCancel(row)) { selected = row }
                    }
                    if state.hasMore {
                        Button("Autres réservations") { Task { await state.more() } }
                            .disabled(state.busy).frame(minHeight: 44).accessibilityIdentifier("reservations.more")
                    }
                }.font(.sgmBody(15)).padding(.horizontal, SGMSpace.padScreen)
            }
        }.foregroundStyle(SGM.textPrimary)
            .task(id: scenePhase) { if scenePhase == .active { await state.resume() } else { state.suspend() } }
            .onChange(of: scenePhase) { _, phase in if phase != .active { selected = nil; state.suspend() } }
            .onChange(of: state.live) { _, live in if !live { selected = nil } }
            .onDisappear { selected = nil; state.suspend() }
            .confirmationDialog("Annuler cette réservation ?", isPresented: Binding(
                get: { selected != nil }, set: { if !$0 { selected = nil } }), titleVisibility: .visible, presenting: selected) { row in
                Button("Annuler la réservation", role: .destructive) { selected = nil; Task { await state.cancel(row) } }
                    .disabled(!state.canCancel(row)).accessibilityIdentifier("reservations.cancel.confirm")
                Button("Conserver", role: .cancel) { selected = nil }
            } message: { row in
                Text("\(row.title) · \(row.date) · \(row.time) · \(row.seats) place(s)")
            }
    }
    private var visible: [ParentReservation] { state.items.filter { $0.status.historical == history } }
}

private struct ParentReservationRow: View {
    let row: ParentReservation
    let canCancel: Bool
    let cancel: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(row.status.label).font(.sgmBody(13, weight: .semibold))
            Text(row.title).font(.sgmDisplay(18)).fixedSize(horizontal: false, vertical: true)
            Text(row.club)
            Text("\(row.date) · \(row.time)")
            if let child = row.childLabel { Text(child) }
            Text("\(row.seats) place\(row.seats > 1 ? "s" : "") · \(row.price)")
            if row.refundPending { Text("Remboursement en attente").foregroundStyle(SGM.orange) }
            if canCancel {
                Button("Annuler la réservation", role: .destructive, action: cancel)
                    .frame(minHeight: 44).accessibilityIdentifier("reservations.cancel." + row.id)
            }
        }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: 8))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("reservations.row." + row.id)
    }
}
