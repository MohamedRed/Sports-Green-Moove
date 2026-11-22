import SwiftUI
import UIKit

struct ChildInvitationSection: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: ChildInvitationState
    @State private var shared: ChildInvitationShare?
    init(access: AccountAccess, target: ChildAccountTarget, gateway: any ChildAccountGateway) {
        _state = State(initialValue: ChildInvitationState(access: access, target: target, gateway: gateway))
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Inviter l’enfant").font(.sgmBody(18, weight: .bold))
            HStack(alignment: .top) {
                if let status = state.current?.status { Text(label(status)).fixedSize(horizontal: false, vertical: true) }
                Spacer(minLength: 8)
                Button { Task { await state.refresh() } } label: { Image(systemName: "arrow.clockwise").frame(width: 44, height: 44) }
                    .disabled(state.busy).accessibilityLabel("Actualiser l’invitation").accessibilityIdentifier("child-invitation.refresh")
            }
            if state.busy { ProgressView().accessibilityLabel("Vérification de l’invitation") }
            if let error = state.error { Text(error).accessibilityIdentifier("child-invitation.error") }
            Button(state.current == nil ? "Créer une invitation" : "Créer une nouvelle invitation") { Task { await state.create() } }
                .disabled(!state.canCreate).frame(minHeight: 44).accessibilityIdentifier("child-invitation.create")
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                Button {
                    if let url = state.sharingURL() { shared = ChildInvitationShare(url: url) }
                } label: { Label("Partager le lien", systemImage: "square.and.arrow.up") }
                    .disabled(state.sharingURL() == nil).frame(minHeight: 44).accessibilityIdentifier("child-invitation.share")
            }
            Button("Révoquer l’invitation", role: .destructive) { Task { await state.revoke() } }
                .disabled(!state.canRevoke).frame(minHeight: 44).accessibilityIdentifier("child-invitation.revoke")
        }.frame(maxWidth: .infinity, alignment: .leading)
            .sheet(item: $shared) { item in ChildInvitationActivity(url: item.url) }
            .task(id: scenePhase) { if scenePhase == .active { await state.resume() } else { state.suspend() } }
            .onChange(of: scenePhase) { _, phase in if phase != .active { state.suspend(); shared = nil } }
            .onDisappear { state.close(); shared = nil }
    }
    private func label(_ status: ChildInvitationStatus) -> String {
        switch status {
        case .pending: "Invitation en attente"
        case .provisioning: "Inscription en cours"
        case .accepted: "Inscription effectuée"
        case .revoked: "Invitation révoquée"
        }
    }
}

private struct ChildInvitationShare: Identifiable { let id = UUID(); let url: URL }
private struct ChildInvitationActivity: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [url], applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
