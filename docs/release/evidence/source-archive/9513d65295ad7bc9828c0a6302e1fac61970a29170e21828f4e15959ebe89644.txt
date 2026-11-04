import SwiftUI

struct SupportInboxScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: SupportInboxState
    init(uid: String, gateway: any SupportGateway) { _state = State(initialValue: SupportInboxState(uid: uid, gateway: gateway)) }

    var body: some View {
        SGMScreen(testID: "support.inbox") {
            HStack {
                Button { if state.selectedId == nil { dismiss() } else { Task { await state.back() } } } label: {
                    Image(systemName: "chevron.left").frame(width: 44, height: 44)
                }.accessibilityLabel("Retour")
                Text(state.selectedId == nil ? "MES DEMANDES" : "MA DEMANDE").font(.sgmDisplay(24))
                Spacer()
                Button { Task { await state.refresh() } } label: {
                    Image(systemName: "arrow.clockwise").frame(width: 44, height: 44)
                }.disabled(state.busy).accessibilityLabel("Actualiser les demandes")
            }.foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen)
            VStack(alignment: .leading, spacing: 20) {
                if state.busy { ProgressView().accessibilityLabel("Chargement") }
                if let error = state.error { Text(error).accessibilityIdentifier("support.error") }
                if state.loaded, state.selectedId == nil, state.reports.isEmpty { Text("Vous n’avez pas encore de demande.") }
                if state.selectedId == nil {
                    ForEach(state.reports) { report in
                        Button { Task { await state.open(report.id) } } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(report.reason).font(.sgmBody(17, weight: .bold))
                                Text(report.status.label)
                                date(report.createdAtMillis)
                                if let reply = report.lastReply { Text(reply.text) }
                            }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8).contentShape(Rectangle())
                        }.buttonStyle(.plain).disabled(state.busy).accessibilityIdentifier("support.report.\(report.id)")
                    }
                }
                if let detail = state.detail {
                    Text(detail.report.reason).font(.sgmBody(17, weight: .bold))
                    Text(detail.report.status.label).accessibilityIdentifier("support.detail.status")
                    Text(detail.report.description)
                    date(detail.report.createdAtMillis)
                    if detail.report.emergency { Text("Demande signalée urgente") }
                    if detail.replies.items.isEmpty { Text("Aucune réponse pour le moment.") }
                    ForEach(detail.replies.items) { reply in
                        VStack(alignment: .leading, spacing: 8) { date(reply.sentAtMillis); Text(reply.text) }
                            .accessibilityIdentifier("support.reply.\(reply.id)")
                    }
                }
                if state.hasMore {
                    Button("Charger la suite") { Task { await state.more() } }.disabled(state.busy)
                }
            }.font(.sgmBody(14)).foregroundStyle(SGM.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, SGMSpace.padScreen)
        }
        .task(id: scenePhase) { if scenePhase == .active { await state.refresh() } else { state.clear() } }
        .onDisappear { state.close() }
    }
    private func date(_ millis: Int64) -> some View {
        Text(Date(timeIntervalSince1970: Double(millis) / 1000).formatted(date: .abbreviated, time: .shortened))
    }
}
