import SwiftUI

struct EmergencyContactEntry: View {
    @Environment(AppState.self) private var appState
    let access: AccountAccess
    var rideId: String?
    var testID = "emergency.entry"
    @State private var presented = false

    var body: some View {
        Button { presented = true } label: {
            Label("Contact d’urgence", systemImage: "phone")
                .font(.sgmBody(16, weight: .semibold))
                .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 14)
                .contentShape(Rectangle())
        }.buttonStyle(.plain).foregroundStyle(SGM.textPrimary).accessibilityIdentifier(testID).disabled(!access.isCurrent)
            .sheet(isPresented: $presented) {
                EmergencyContactHost(access: access, scope: access.context.grantedRoles.contains(.child)
                    ? .childRide(rideId) : .managed(.personal), gateway: appState.firebase)
                    .id(access.context.id)
            }
    }
}

struct EmergencyContactScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: EmergencyContactState
    @State private var discard: DiscardAction?
    private let opener: any EmergencyPhoneOpening
    private let onChooseTarget: (() -> Void)?
    private let onManageAccount: ((EmergencyContactView?) -> Void)?
    private enum DiscardAction { case close, refresh, chooseTarget }

    init(access: AccountAccess, scope: EmergencyContactScope, gateway: any EmergencyContactGateway,
        opener: any EmergencyPhoneOpening = SystemEmergencyPhone(), onChooseTarget: (() -> Void)? = nil,
        onManageAccount: ((EmergencyContactView?) -> Void)? = nil) {
        _state = State(initialValue: EmergencyContactState(access: access, scope: scope, gateway: gateway))
        self.opener = opener; self.onChooseTarget = onChooseTarget; self.onManageAccount = onManageAccount
    }
    var body: some View {
        @Bindable var state = state
        SGMScreen(bottomPadding: 30, testID: "emergency.screen") {
            HStack(alignment: .top) {
                Button { if state.pending != nil { state.cancelReview() } else if state.dirty { discard = .close } else { dismiss() } } label: {
                    Image(systemName: "chevron.left").frame(width: 44, height: 44)
                }.accessibilityLabel("Retour").accessibilityIdentifier("emergency.back")
                Text("CONTACT D’URGENCE").font(.sgmDisplay(24))
                    .fixedSize(horizontal: false, vertical: true).frame(maxWidth: .infinity, alignment: .leading)
                Button { if state.dirty { discard = .refresh } else { Task { await state.refresh() } } } label: {
                    Image(systemName: "arrow.clockwise").frame(width: 44, height: 44)
                }.disabled(state.busy || state.pending != nil).accessibilityLabel("Actualiser le contact")
                    .accessibilityIdentifier("emergency.refresh")
            }.foregroundStyle(SGM.textPrimary)
            if let operation = state.pending {
                EmergencyContactReview(operation: operation, confirm: { Task { await state.confirmSave() } }, cancel: { state.cancelReview() })
            } else {
                VStack(alignment: .leading, spacing: 20) {
                    if state.scope.readOnly, let onManageAccount {
                        Button("Lier mon compte") { onManageAccount(nil) }.frame(minHeight: 44)
                            .disabled(!state.accountIsCurrent).accessibilityIdentifier("child-account.entry.child")
                    }
                    if let onChooseTarget {
                        Button("Choisir un contact") { if state.dirty { discard = .chooseTarget } else { onChooseTarget() } }
                            .disabled(state.busy).accessibilityIdentifier("emergency.choose-target")
                    }
                    if state.busy { ProgressView().accessibilityLabel("Vérification du contact") }
                    if let error = state.error { Text(error).foregroundStyle(SGM.textPrimary).accessibilityIdentifier("emergency.error") }
                    if let notice = state.notice { Text(notice).accessibilityIdentifier("emergency.notice") }
                    if let view = state.view {
                        if state.canEdit, case .managed(.child) = view.scope, let onManageAccount {
                            Button("Compte de l’enfant") { onManageAccount(view) }
                                .disabled(state.busy || state.dirty).frame(minHeight: 44).accessibilityIdentifier("child-account.entry.parent")
                        }
                        if let name = view.childName {
                            Text(name).font(.sgmBody(18, weight: .bold)).accessibilityIdentifier("emergency.subject.child")
                        }
                        if let club = view.clubName {
                            Text(club).foregroundStyle(SGM.textSecondary).accessibilityIdentifier("emergency.subject.club")
                        }
                        if let contact = view.contact {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(contact.name).font(.sgmBody(18, weight: .bold)).accessibilityIdentifier("emergency.contact.name")
                                Text(contact.phone).textSelection(.disabled).accessibilityIdentifier("emergency.contact.phone")
                            }
                        } else { Text("Aucun contact enregistré.").accessibilityIdentifier("emergency.empty") }
                        if state.canEdit {
                            VStack(alignment: .leading, spacing: 14) {
                                TextField("Nom du contact", text: $state.name).textContentType(.name)
                                    .accessibilityIdentifier("emergency.name.input")
                                TextField("Numéro international", text: $state.phone).keyboardType(.phonePad)
                                    .textContentType(.telephoneNumber).textInputAutocapitalization(.never).autocorrectionDisabled()
                                    .accessibilityIdentifier("emergency.phone.input")
                            }.textFieldStyle(.roundedBorder).disabled(state.busy)
                            Button("Enregistrer") { state.reviewSave() }.disabled(!state.canSave)
                                .accessibilityIdentifier("emergency.save")
                            if state.dirty {
                                Button("Annuler les modifications") { state.discardEdits() }.disabled(state.busy)
                            }
                            if view.contact != nil {
                                Button("Supprimer le contact", role: .destructive) { state.reviewSave(removing: true) }
                                    .disabled(state.busy).accessibilityIdentifier("emergency.remove")
                            }
                        }
                    } else if state.loaded && state.scope.readOnly {
                        Text("Aucun trajet actif.").accessibilityIdentifier("emergency.no-active-ride")
                    }
                    if state.view?.contact != nil {
                        Button { Task { await state.dial(using: opener) } } label: {
                            Label("Ouvrir Téléphone", systemImage: "phone").frame(minHeight: 44)
                        }.disabled(!state.canDial).accessibilityIdentifier("emergency.phone.open")
                    }
                }.font(.sgmBody(16)).foregroundStyle(SGM.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }.padding(.horizontal, SGMSpace.padScreen)
            .scrollDismissesKeyboard(.interactively)
            .interactiveDismissDisabled(state.dirty || state.busy)
            .alert("Abandonner les modifications ?", isPresented: Binding(get: { discard != nil }, set: { if !$0 { discard = nil } }),
                presenting: discard) { action in
                Button("Abandonner les modifications", role: .destructive) {
                    discard = nil
                    switch action {
                    case .close: dismiss()
                    case .refresh: Task { await state.refresh() }
                    case .chooseTarget: onChooseTarget?()
                    }
                }
                Button("Continuer la modification", role: .cancel) { discard = nil }
            }
            .task(id: scenePhase) { if scenePhase == .active { await state.resume() } else { state.suspend() } }
            .onChange(of: scenePhase) { _, phase in if phase != .active { state.suspend(); discard = nil } }
            .onDisappear { state.close() }
    }
}

private struct EmergencyContactReview: View {
    let operation: EmergencyContactOperation
    let confirm: () -> Void
    let cancel: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text(operation.contact == nil ? "SUPPRIMER LE CONTACT ?" : "CONFIRMER LE CONTACT").font(.sgmDisplay(24))
            if let contact = operation.contact { Text(contact.name); Text(contact.phone) }
            Button("Confirmer", action: confirm).accessibilityIdentifier("emergency.confirm")
            Button("Annuler", role: .cancel, action: cancel).accessibilityIdentifier("emergency.cancel")
        }.font(.sgmBody(16)).foregroundStyle(SGM.textPrimary).padding(.vertical, 20)
    }
}
