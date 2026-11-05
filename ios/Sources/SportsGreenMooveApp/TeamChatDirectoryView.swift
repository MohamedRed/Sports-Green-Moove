import SwiftUI

struct TeamChatHost: View {
    @Environment(\.dismiss) private var dismiss
    let access: AccountAccess
    let gateway: any TeamChatGateway
    @State private var clubId: String?
    @State private var target: TeamChatTarget?
    @State private var directoryId = UUID()
    var body: some View {
        Group {
            if let target {
                TeamChatThreadView(access: access, target: target, gateway: gateway) {
                    self.target = nil; directoryId = UUID()
                }.id(target)
            } else {
                TeamChatDirectoryView(access: access, clubId: clubId, gateway: gateway, onBack: {
                    if clubId == nil { dismiss() } else { clubId = nil; directoryId = UUID() }
                }, onSelect: { row in
                    if clubId == nil { clubId = row.id; directoryId = UUID() }
                    else if let instance = row.instanceId { target = .init(teamId: row.id, instanceId: instance) }
                }).id(directoryId)
            }
        }.onChange(of: access.isCurrent) { _, current in if !current { dismiss() } }
    }
}

private struct TeamChatDirectoryView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: TeamChatDirectoryState
    let onBack: () -> Void
    let onSelect: (TeamChatChoice) -> Void
    init(access: AccountAccess, clubId: String?, gateway: any TeamChatGateway,
        onBack: @escaping () -> Void, onSelect: @escaping (TeamChatChoice) -> Void) {
        _state = State(initialValue: TeamChatDirectoryState(access: access, clubId: clubId, gateway: gateway))
        self.onBack = onBack; self.onSelect = onSelect
    }
    var body: some View {
        SGMScreen(bottomPadding: 30, testID: "team-chat.directory") {
            TeamChatHeader(title: state.clubId == nil ? "CLUBS" : "ÉQUIPES", busy: state.busy,
                back: { state.close(); onBack() }, refresh: { Task { await state.refresh() } })
            if state.live {
                VStack(alignment: .leading, spacing: 16) {
                    if state.busy { ProgressView().accessibilityLabel("Chargement des équipes") }
                    if let error = state.error { Text(error).accessibilityIdentifier("team-chat.directory.error") }
                    if state.loaded && state.items.isEmpty && !state.hasMore {
                        Text(state.clubId == nil ? "Aucun club disponible." : "Aucune équipe approuvée.")
                    }
                    ForEach(state.items) { row in
                        Button { if let choice = state.select(row) { onSelect(choice) } } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Text(row.name ?? "Nom indisponible").font(.sgmBody(17, weight: .semibold))
                                    .fixedSize(horizontal: false, vertical: true).frame(maxWidth: .infinity, alignment: .leading)
                                if let unread = row.unreadCount, unread > 0 {
                                    Text(unread > 99 ? "99+ non lus" : "\(unread) non lu\(unread == 1 ? "" : "s")")
                                        .font(.sgmBody(12)).fixedSize(horizontal: false, vertical: true)
                                }
                                Image(systemName: "chevron.right").frame(width: 24, height: 24)
                            }.frame(minHeight: 44).padding(.vertical, 10).contentShape(Rectangle())
                        }.buttonStyle(.plain).disabled(state.busy || row.name == nil)
                            .accessibilityIdentifier("team-chat.choice.\(row.id)")
                    }
                    if state.hasMore {
                        Button("Autres choix") { Task { await state.more() } }.disabled(state.busy)
                            .frame(minHeight: 44).accessibilityIdentifier("team-chat.choices-more")
                    }
                }.font(.sgmBody(15)).foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen)
            }
        }.task(id: scenePhase) { if scenePhase == .active { await state.resume() } else { state.suspend() } }
            .onChange(of: scenePhase) { _, phase in if phase != .active { state.suspend() } }
            .onDisappear { state.close() }
    }
}

struct TeamChatHeader: View {
    let title: String
    let busy: Bool
    let back: () -> Void
    let refresh: () -> Void
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: back) { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                .accessibilityLabel("Retour").help("Retour").accessibilityIdentifier("team-chat.back")
            Text(title).font(.sgmDisplay(24)).fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6)
            Button(action: refresh) { Image(systemName: "arrow.clockwise").frame(width: 44, height: 44) }
                .disabled(busy).accessibilityLabel("Actualiser").help("Actualiser").accessibilityIdentifier("team-chat.refresh")
        }.buttonStyle(.plain).foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen)
    }
}
