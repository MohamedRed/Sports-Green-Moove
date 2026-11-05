import SwiftUI

@MainActor struct ActiveRideChatEntry: View {
    @Environment(\.scenePhase) private var phase
    @State private var selection: ActiveRideChatSelection?
    @State private var error: String?
    let access: AccountAccess
    let gateway: any RideChatGateway
    let rideId: String
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                do {
                    guard access.isCurrent && phase == .active else { return }
                    selection = try .init(uid: RideChatID(access.context.uid),
                        reference: RideChatReference(kind: .rideSession, sourceId: RideChatID(rideId)))
                    error = nil
                } catch { self.error = "Conversation indisponible. Actualisez la course." }
            } label: {
                Label("Conversation de la course", systemImage: "bubble.left.and.bubble.right")
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityIdentifier("ride-chat.active-entry")
            if let error { Text(error).font(.sgmBody(13)) }
        }.foregroundStyle(SGM.textPrimary)
            .sheet(item: $selection) { item in
                RideChatModalHost(uid: item.uid, access: access, gateway: gateway,
                    initial: .init(reference: item.reference, context: nil)).id(access.context.id)
            }
            .onChange(of: phase) { _, next in if next != .active { selection = nil; error = nil } }
            .onChange(of: access.isCurrent) { _, current in if !current { selection = nil; error = nil } }
            .onChange(of: rideId) { _, _ in selection = nil; error = nil }
            .onDisappear { selection = nil; error = nil }
    }
}
private struct ActiveRideChatSelection: Identifiable {
    let id = UUID()
    let uid: RideChatID
    let reference: RideChatReference
}
