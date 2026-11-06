import SwiftUI

struct EmergencyContactHost: View {
    let access: AccountAccess
    let gateway: any EmergencyContactGateway & ChildAccountGateway
    @State private var selected: EmergencyContactScope
    @State private var picking = false
    @State private var editorId = UUID()
    @State private var accountPresentation: ChildAccountPresentation?

    init(access: AccountAccess, scope: EmergencyContactScope, gateway: any EmergencyContactGateway & ChildAccountGateway) {
        self.access = access; self.gateway = gateway
        _selected = State(initialValue: scope)
    }
    private var parent: Bool { access.context.role == .parent && !access.context.grantedRoles.contains(.child) }
    var body: some View {
        Group { if picking && parent {
            GuardianContactPicker(access: access, gateway: gateway, onBack: { showEditor(selected) }, onChoose: { showEditor(.managed($0)) })
        } else {
            EmergencyContactScreen(access: access, scope: selected, gateway: gateway,
                onChooseTarget: parent ? { picking = true } : nil,
                onManageAccount: { view in
                    do { accountPresentation = try ChildAccountPresentation(access: access, view: view) }
                    catch { return }
                }).id(editorId)
        } }.sheet(item: $accountPresentation) { presentation in
            ChildAccountScreen(access: access, target: presentation.target, gateway: gateway).id(presentation.id)
        }
    }
    private func showEditor(_ scope: EmergencyContactScope) {
        guard access.isCurrent else { return }
        selected = scope; editorId = UUID(); picking = false
    }
}

struct GuardianContactPicker: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: GuardianContactState
    let onBack: () -> Void
    let onChoose: (EmergencyContactTarget) -> Void
    init(access: AccountAccess, gateway: any EmergencyContactGateway, onBack: @escaping () -> Void,
        onChoose: @escaping (EmergencyContactTarget) -> Void) {
        _state = State(initialValue: GuardianContactState(access: access, gateway: gateway))
        self.onBack = onBack; self.onChoose = onChoose
    }
    var body: some View {
        SGMScreen(bottomPadding: 30, testID: "emergency.targets") {
            HStack(alignment: .top) {
                Button(action: onBack) { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                    .accessibilityLabel("Retour").accessibilityIdentifier("emergency.targets.back")
                Text("CHOISIR UN CONTACT").font(.sgmDisplay(24)).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button { Task { await state.refresh() } } label: {
                    Image(systemName: "arrow.clockwise").frame(width: 44, height: 44)
                }.disabled(state.busy).accessibilityLabel("Actualiser les liens vérifiés")
                    .accessibilityIdentifier("emergency.targets.refresh")
            }
            Button("Mon contact") { if let target = state.personal() { onChoose(target) } }
                .disabled(state.busy).frame(minHeight: 44).accessibilityIdentifier("emergency.targets.personal")
            if state.busy { ProgressView().accessibilityLabel("Chargement des liens vérifiés") }
            if let error = state.error { Text(error).accessibilityIdentifier("emergency.targets.error") }
            if state.loaded && state.choices.isEmpty && !state.hasMore { Text("Aucun lien vérifié disponible.") }
            ForEach(state.choices) { row in
                Button { if let target = state.select(row) { onChoose(target) } } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        if let name = row.childName { Text(name).font(.sgmBody(18, weight: .bold)) }
                        else { Text("Profil indisponible") }
                        if let club = row.clubName { Text(club).foregroundStyle(SGM.textSecondary) }
                        else { Text("Club indisponible") }
                    }.frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).padding(.vertical, 12)
                        .contentShape(Rectangle())
                }.buttonStyle(.plain).disabled(state.busy || !row.selectable).accessibilityIdentifier("emergency.target.\(row.id)")
            }
            if state.hasMore {
                Button("Charger la suite") { Task { await state.more() } }.disabled(state.busy)
                    .frame(minHeight: 44).accessibilityIdentifier("emergency.targets.more")
            }
        }.font(.sgmBody(16)).foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen)
            .task(id: scenePhase) { if scenePhase == .active { await state.resume() } else { state.suspend() } }
            .onChange(of: scenePhase) { _, phase in if phase != .active { state.suspend() } }
            .onDisappear { state.close() }
    }
}
