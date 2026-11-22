import SwiftUI

struct RideChatSelection: Sendable { let reference: RideChatReference; let context: RideChatContext? }
private struct RideChatPresentation: Identifiable { let id = UUID(); let selection: RideChatSelection? }
struct RideChatViewTaskKey: Equatable { let phase: ScenePhase; let epoch: UUID; let waiting: Bool }

@MainActor struct RideChatEntry: View {
    @Environment(\.scenePhase) private var phase
    @State private var state: RideChatDirectoryState?
    @State private var error: String?
    @State private var presentation: RideChatPresentation?
    @State private var internalEpoch = UUID()
    let access: AccountAccess
    let gateway: any RideChatGateway
    let epoch: UUID
    let onUnread: (Int?) -> Void
    let onClosed: () -> Void
    var body: some View {
        Group {
            if let state {
                RideChatDirectoryContent(state: state, onNew: { presentation = .init(selection: nil) }, onOpen: { row in
                    if let row = state.selected(row) { presentation = .init(selection: .init(reference: row.reference, context: row.context)) }
                })
            } else if let error { Text(error).accessibilityIdentifier("ride-chat.directory.error") }
            else { ProgressView().accessibilityLabel("Chargement des conversations") }
        }
        .task(id: RideChatEntryTaskKey(phase: phase, external: epoch, internalEpoch: internalEpoch, waiting: access.waitingForEarlierWork)) {
            state?.suspend()
            guard phase == .active, !access.waitingForEarlierWork, access.isCurrent else { return }
            if state == nil {
                do { state = try .init(uid: RideChatID(access.context.uid), access: access, gateway: gateway); error = nil }
                catch { self.error = "Conversations indisponibles. Reconnectez-vous."; return }
            }
            await state?.run()
        }
        .onChange(of: phase) { _, next in if next != .active { presentation = nil; state?.suspend(); onUnread(nil) } }
        .onChange(of: access.isCurrent) { _, current in if !current { presentation = nil; state?.close(); onUnread(nil) } }
        .onChange(of: state?.unreadCount, initial: true) { _, count in onUnread(count) }
        .onDisappear { state?.suspend(); onUnread(nil) }
        .sheet(item: $presentation, onDismiss: { internalEpoch = UUID(); onClosed() }) { item in
            if let state { RideChatModalHost(uid: state.uid, access: access, gateway: gateway, initial: item.selection).id(access.context.id) }
        }
    }
}
private struct RideChatEntryTaskKey: Equatable {
    let phase: ScenePhase; let external: UUID; let internalEpoch: UUID; let waiting: Bool
}

@MainActor struct RideChatModalHost: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selected: RideChatSelection?
    @State private var directoryId = UUID()
    let uid: RideChatID
    let access: AccountAccess
    let gateway: any RideChatGateway
    let initial: RideChatSelection?
    init(uid: RideChatID, access: AccountAccess, gateway: any RideChatGateway, initial: RideChatSelection?) {
        self.uid = uid; self.access = access; self.gateway = gateway; self.initial = initial
        _selected = State(initialValue: initial)
    }
    var body: some View {
        Group {
            if let selected {
                RideChatThreadView(uid: uid, selection: selected, access: access, gateway: gateway) {
                    if initial != nil { dismiss() } else { self.selected = nil; directoryId = UUID() }
                }.id(selected.reference)
            } else {
                RideChatBookingView(uid: uid, access: access, gateway: gateway, onBack: { dismiss() }, onSelect: {
                    selected = .init(reference: $0.reference, context: $0.context)
                }).id(directoryId)
            }
        }.onChange(of: access.isCurrent) { _, current in if !current { selected = nil; dismiss() } }
    }
}
