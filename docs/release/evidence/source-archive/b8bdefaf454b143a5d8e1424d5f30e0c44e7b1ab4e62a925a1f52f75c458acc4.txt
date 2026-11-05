import SwiftUI

struct ProfileCityEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: ProfileCityState
    @State private var discard: CityDiscard?
    private enum CityDiscard { case close, refresh }
    init(access: AccountAccess, gateway: any ProfileCityGateway) {
        _state = State(initialValue: ProfileCityState(access: access, gateway: gateway))
    }
    var body: some View {
        @Bindable var state = state
        SGMScreen(bottomPadding: 30, testID: "city.screen") {
            HStack(alignment: .top, spacing: 12) {
                Button {
                    if state.dirty || state.pending != nil { discard = .close } else { dismiss() }
                } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                    .disabled(state.busy).accessibilityLabel("Retour").accessibilityIdentifier("city.back")
                Text("MA VILLE").font(.sgmDisplay(24)).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6)
                Button {
                    if state.dirty || state.pending != nil { discard = .refresh } else { Task { await state.refresh() } }
                } label: { Image(systemName: "arrow.clockwise").frame(width: 44, height: 44) }
                    .disabled(state.busy).accessibilityLabel("Actualiser la ville").help("Actualiser la ville")
                    .accessibilityIdentifier("city.refresh")
            }.buttonStyle(.plain)
            if state.live {
                if state.busy { ProgressView().accessibilityLabel("Vérification de la ville") }
                if let error = state.error { Text(error).accessibilityIdentifier("city.error") }
                if let notice = state.notice { Text(notice).accessibilityIdentifier("city.notice") }
                if state.view != nil || state.pending != nil {
                    TextField("Ville", text: $state.input).textContentType(.addressCity).textInputAutocapitalization(.words)
                        .autocorrectionDisabled().textFieldStyle(.roundedBorder).accessibilityIdentifier("city.input")
                        .disabled(state.busy || state.pending != nil)
                    Button(state.pending == nil ? "Enregistrer" : "Réessayer") { Task { await state.save() } }
                        .frame(minHeight: 44).disabled(!state.canSave).accessibilityIdentifier("city.save")
                    if state.view?.city != nil {
                        Button("Supprimer la ville", role: .destructive) { Task { await state.save(removing: true) } }
                            .frame(minHeight: 44).disabled(!state.canRemove).accessibilityIdentifier("city.remove")
                    }
                }
            }
        }.padding(.horizontal, SGMSpace.padScreen).foregroundStyle(SGM.textPrimary).font(.sgmBody(16))
            .scrollDismissesKeyboard(.interactively).interactiveDismissDisabled(state.dirty || state.busy || state.pending != nil)
            .alert(discard == .refresh ? "Actualiser la ville ?" : state.pending == nil ? "Abandonner les modifications ?" : "Fermer sans confirmation ?",
                isPresented: Binding(get: { discard != nil }, set: { if !$0 { discard = nil } }), presenting: discard) { action in
                    Button("Continuer la modification", role: .cancel) { discard = nil }
                    Button(action == .refresh ? "Actualiser" : "Fermer", role: .destructive) {
                        discard = nil
                        switch action { case .close: dismiss(); case .refresh: Task { await state.refresh() } }
                    }
                }
            .task(id: scenePhase) { if scenePhase == .active { await state.resume() } else { state.suspend() } }
            .onChange(of: scenePhase) { _, phase in if phase != .active { discard = nil; state.suspend() } }
            .onChange(of: state.live) { _, live in if !live { discard = nil; dismiss() } }
            .onDisappear { state.close() }
    }
}
