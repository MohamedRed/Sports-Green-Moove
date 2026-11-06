import SwiftUI

struct ChildAccountScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: ChildAccountState
    private let access: AccountAccess
    private let gateway: any ChildAccountGateway
    init(access: AccountAccess, target: ChildAccountTarget?, gateway: any ChildAccountGateway) {
        self.access = access; self.gateway = gateway
        _state = State(initialValue: ChildAccountState(access: access, target: target, gateway: gateway))
    }
    var body: some View {
        SGMScreen(bottomPadding: 30, testID: "child-account.screen") {
            HStack(alignment: .top) {
                Button { dismiss() } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                    .accessibilityLabel("Retour").accessibilityIdentifier("child-account.back")
                Text("COMPTE ENFANT").font(.sgmDisplay(24)).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let target = state.target {
                Text(target.childName).font(.sgmBody(18, weight: .bold))
                ChildInvitationSection(access: access, target: target, gateway: gateway)
                VStack(alignment: .leading, spacing: 16) {
                    Text("Lier le compte").font(.sgmBody(18, weight: .bold))
                    if state.approved { Text("Compte lié.").accessibilityIdentifier("child-account.approved") }
                    else {
                        TextField("Code du compte enfant", text: Binding(get: { state.input }, set: state.edit))
                            .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.asciiCapable)
                            .textFieldStyle(.roundedBorder).disabled(state.busy).accessibilityIdentifier("child-account.input")
                        Button("Autoriser la liaison") { Task { await state.approve() } }
                            .disabled(!state.canApprove).frame(minHeight: 44).accessibilityIdentifier("child-account.approve")
                    }
                }.padding(.top, 16)
            } else if state.isChild {
                TimelineView(.periodic(from: .now, by: 1)) { _ in
                    if let code = state.activeCode {
                        Text(code.code).font(.system(.body, design: .monospaced)).textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true).accessibilityIdentifier("child-account.code")
                    }
                    Button("Créer un code") { Task { await state.create() } }
                        .disabled(!state.canCreate).frame(minHeight: 44).accessibilityIdentifier("child-account.create-code")
                }
            }
            if state.busy { ProgressView().accessibilityLabel("Vérification du compte") }
            if let error = state.error { Text(error).accessibilityIdentifier("child-account.error") }
        }.font(.sgmBody(16)).foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen)
            .scrollDismissesKeyboard(.interactively).interactiveDismissDisabled(state.busy)
            .onChange(of: scenePhase) { _, phase in if phase == .active { state.resume() } else { state.suspend() } }
            .onDisappear { state.close() }
    }
}
