import SwiftUI

struct SupportSubmissionCard: View {
    let uid: String
    let gateway: any FirebaseGateway
    @State private var state: SupportSubmissionState?
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let state {
                VStack(alignment: .leading, spacing: 10) {
                    Text("SIGNALER AU SUPPORT").font(.sgmDisplay(18)).foregroundStyle(SGM.textPrimary)
                    field("Raison", Binding(get: { state.reason }, set: { state.setReason($0) }), .horizontal, state.editable)
                    field("Description", Binding(get: { state.description }, set: { state.setDescription($0) }), .vertical, state.editable)
                    Toggle("Urgent", isOn: Binding(get: { state.emergency }, set: { state.setEmergency($0) }))
                        .font(.sgmBody(13, weight: .bold)).foregroundStyle(SGM.textPrimary).tint(SGM.green).disabled(!state.editable)
                    SGMButton(title: state.busy ? "ENVOI..." : state.pending != nil || !state.ready ? "RÉESSAYER" : "ENVOYER",
                        testID: UITestIdentifier.supportReportAction, action: {
                            if !state.ready { state.restore() } else { Task { await state.submit() } }
                        }).disabled(state.busy)
                    if let message = state.message {
                        Text(message).font(.sgmBody(12, weight: .bold))
                            .foregroundStyle(SGM.textPrimary)
                    }
                }
                .padding(14)
                .background(SGM.bgSurface, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
                .padding(.horizontal, SGMSpace.padScreen)
            } else {
                ProgressView().tint(SGM.green).frame(maxWidth: .infinity)
            }
        }
        .onAppear { state = SupportSubmissionState(uid: uid, submitter: { try await gateway.createReport(submission: $0) }) }
        .onDisappear { state?.close(); state = nil }
    }
    private func field(_ label: String, _ text: Binding<String>, _ axis: Axis, _ enabled: Bool) -> some View {
        TextField(label, text: text, axis: axis).disabled(!enabled)
            .font(.sgmBody(14, weight: .medium)).foregroundStyle(SGM.textPrimary)
            .lineLimit(axis == .vertical ? 3...5 : 1...1)
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(SGM.bgInput, in: RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SGMRadius.md, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}
