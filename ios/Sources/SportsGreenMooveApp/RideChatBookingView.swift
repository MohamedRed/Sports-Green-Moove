import SwiftUI

@MainActor struct RideChatBookingView: View {
    @Environment(\.scenePhase) private var phase
    @State private var state: RideChatBookingState
    @State private var epoch = UUID()
    let access: AccountAccess
    let onBack: () -> Void
    let onSelect: (RideChatBooking) -> Void
    init(uid: RideChatID, access: AccountAccess, gateway: any RideChatGateway,
        onBack: @escaping () -> Void, onSelect: @escaping (RideChatBooking) -> Void) {
        self.access = access; self.onBack = onBack; self.onSelect = onSelect
        _state = State(initialValue: .init(uid: uid, access: access, gateway: gateway))
    }
    var body: some View {
        SGMScreen(bottomPadding: 30, testID: "ride-chat.bookings") {
            RideChatHeader(title: "RÉSERVATIONS", busy: state.busy, onBack: { state.close(); onBack() }, onRefresh: { epoch = UUID() })
            if state.live {
                VStack(alignment: .leading, spacing: 16) {
                    if state.busy || !state.loaded && state.error == nil { ProgressView().accessibilityLabel("Chargement des réservations") }
                    if let error = state.error { Text(error).accessibilityIdentifier("ride-chat.bookings.error") }
                    if state.loaded && state.items.isEmpty && !state.hasMore { Text("Aucune réservation.") }
                    ForEach(state.items) { row in
                        Button { if let selected = state.selected(row) { onSelect(selected) } } label: {
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(row.context.title).font(.sgmBody(16, weight: .semibold))
                                    Text(row.context.departureLabel).font(.sgmBody(13))
                                    if let peer = row.context.peerLabel { Text(peer).font(.sgmBody(13)) }
                                    if let child = row.context.childLabel { Text(child).font(.sgmBody(13)) }
                                    Text(row.status.label).font(.sgmBody(13)).foregroundStyle(SGM.textMuted)
                                }.fixedSize(horizontal: false, vertical: true).frame(maxWidth: .infinity, alignment: .leading)
                                Image(systemName: "chevron.right").frame(width: 24, height: 24)
                            }.frame(minHeight: 44).padding(.vertical, 10).contentShape(Rectangle())
                        }.buttonStyle(.plain).disabled(state.busy).accessibilityIdentifier("ride-chat.booking.\(row.reference.sourceId.value)")
                    }
                    if state.hasMore {
                        Button("Autres réservations") { Task { await state.more() } }.disabled(state.busy)
                            .frame(minHeight: 44).accessibilityIdentifier("ride-chat.bookings.more")
                    }
                }.font(.sgmBody(14)).foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen)
            }
        }
        .task(id: RideChatViewTaskKey(phase: phase, epoch: epoch, waiting: access.waitingForEarlierWork)) {
            state.suspend(); if phase == .active && !access.waitingForEarlierWork { await state.run() }
        }
        .onChange(of: phase) { _, next in if next != .active { state.suspend() } }
        .onDisappear { state.close() }
    }
}

@MainActor struct RideChatHeader: View {
    let title: String
    let busy: Bool
    let onBack: () -> Void
    let onRefresh: () -> Void
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: onBack) { Image(systemName: "chevron.left").frame(width: 44, height: 44).contentShape(Rectangle()) }
                .accessibilityLabel("Retour").help("Retour").accessibilityIdentifier("ride-chat.back")
            Text(title).font(.sgmDisplay(24)).fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6)
            Button(action: onRefresh) { Image(systemName: "arrow.clockwise").frame(width: 44, height: 44).contentShape(Rectangle()) }
                .disabled(busy).accessibilityLabel("Actualiser la conversation").help("Actualiser la conversation")
                .accessibilityIdentifier("ride-chat.refresh")
        }.buttonStyle(.plain).foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen)
    }
}
