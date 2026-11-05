import SwiftUI

@MainActor struct RideChatDirectoryContent: View {
    let state: RideChatDirectoryState
    let onNew: () -> Void
    let onOpen: (RideChatDirectoryRow) -> Void
    var body: some View {
        if state.live {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .center, spacing: 12) {
                    Text("Réservations et trajets").font(.sgmBody(17, weight: .semibold)).frame(maxWidth: .infinity, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Button(action: onNew) { Image(systemName: "square.and.pencil").frame(width: 44, height: 44).contentShape(Rectangle()) }
                        .buttonStyle(.plain).disabled(state.busy || state.error != nil)
                        .accessibilityLabel("Nouvelle conversation").help("Nouvelle conversation").accessibilityIdentifier("ride-chat.new")
                }
                if let error = state.error { Text(error).accessibilityIdentifier("ride-chat.directory.error") }
                if state.verifying { ProgressView().accessibilityLabel("Vérification des conversations") }
                if state.loaded && !state.verifying && state.items.isEmpty && state.error == nil && !state.hasMore {
                    Text("Aucune conversation.").accessibilityIdentifier("ride-chat.directory.empty")
                }
                ForEach(state.items) { row in
                    Button { onOpen(row) } label: { RideChatDirectoryRowView(row: row) }
                        .buttonStyle(.plain).accessibilityIdentifier("ride-chat.row.\(row.reference.kind.rawValue).\(row.reference.sourceId.value)")
                        .accessibilityValue("\(row.unreadCount) messages non lus")
                }
                if let error = state.earlierError { Text(error).accessibilityIdentifier("ride-chat.directory.more-error") }
                if state.hasMore {
                    Button("Conversations précédentes") { Task { await state.more() } }.disabled(state.busy)
                        .frame(minHeight: 44).accessibilityIdentifier("ride-chat.directory.more")
                }
            }.font(.sgmBody(14)).foregroundStyle(SGM.textPrimary)
        }
    }
}
private struct RideChatDirectoryRowView: View {
    let row: RideChatDirectoryRow
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: row.reference.kind == .booking ? "ticket" : "car").frame(width: 24, height: 24)
                .foregroundStyle(SGM.textMuted)
            VStack(alignment: .leading, spacing: 5) {
                Text(row.context.title).font(.sgmBody(16, weight: .semibold)).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                Text(row.context.departureLabel).font(.sgmBody(12)).foregroundStyle(SGM.textMuted)
                if let peer = row.context.peerLabel { Text(peer).font(.sgmBody(13)).lineLimit(2) }
                if let child = row.context.childLabel { Text(child).font(.sgmBody(13)).lineLimit(2) }
                Text(row.preview).font(.sgmBody(14)).lineLimit(2).fixedSize(horizontal: false, vertical: true)
            }.frame(maxWidth: .infinity, alignment: .leading)
            if row.unreadCount > 0 {
                Text(row.unreadCount > 99 ? "99+" : "\(row.unreadCount)").font(.sgmBody(12, weight: .bold))
                    .foregroundStyle(SGM.green).frame(minWidth: 30, minHeight: 30)
            }
        }.padding(.vertical, 12).frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
    }
}
