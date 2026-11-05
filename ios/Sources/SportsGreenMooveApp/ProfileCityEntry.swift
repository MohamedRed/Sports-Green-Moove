import SwiftUI

struct ProfileCityEntry: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: ProfileCityState
    @State private var editing = false
    let access: AccountAccess
    let gateway: any ProfileCityGateway
    init(access: AccountAccess, gateway: any ProfileCityGateway) {
        self.access = access; self.gateway = gateway
        _state = State(initialValue: ProfileCityState(access: access, gateway: gateway))
    }
    var body: some View {
        ProfileSettingRow(icon: .location, title: "Ma ville", value: label) { editing = true }
            .accessibilityLabel("Ma ville").accessibilityValue(label)
            .accessibilityIdentifier("profile.city").disabled(!state.live || state.busy)
            .task(id: scenePhase) { if scenePhase == .active { await state.resume() } else { state.suspend() } }
            .onChange(of: scenePhase) { _, phase in if phase != .active { editing = false; state.suspend() } }
            .onChange(of: access.isCurrent) { _, current in if !current { editing = false; state.suspend() } }
            .onDisappear { state.suspend() }
            .sheet(isPresented: $editing, onDismiss: { if scenePhase == .active { Task { await state.resume() } } }) {
                ProfileCityEditor(access: access, gateway: gateway).id(access.context.id)
            }
    }
    private var label: String {
        guard state.live else { return "" }
        if state.busy { return "Chargement…" }
        if let value = state.view { return value.city ?? "Non renseignée" }
        return "Indisponible"
    }
}
