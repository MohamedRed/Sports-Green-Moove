import SwiftUI

@MainActor struct RideChatBubble: View {
    let row: RideChatMessage
    let mine: Bool
    let author: String?
    var body: some View {
        HStack {
            if mine { Spacer(minLength: 24) }
            VStack(alignment: .leading, spacing: 6) {
                Text(mine ? "Vous" : author ?? "Nom indisponible").font(.sgmBody(12, weight: .bold))
                Text(row.body).font(.sgmBody(15)).fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
                    .accessibilityIdentifier("ride-chat.message.\(row.id.value)")
                Text(Date(timeIntervalSince1970: Double(row.position.seconds)).formatted(date: .abbreviated, time: .shortened))
                    .font(.sgmBody(11)).foregroundStyle(SGM.textMuted)
            }.padding(12).background(mine ? SGM.green.opacity(0.12) : SGM.bgCard,
                in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            if !mine { Spacer(minLength: 24) }
        }.foregroundStyle(SGM.textPrimary)
    }
}
@MainActor struct RideChatComposerView: View {
    let state: RideChatThreadState
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let error = state.composer.error { Text(error).font(.sgmBody(13)).accessibilityIdentifier("ride-chat.send-error") }
            if !state.composer.loaded {
                Button("Recharger le brouillon") { state.retryDraft() }.frame(minHeight: 44).accessibilityIdentifier("ride-chat.draft-retry")
            } else {
                HStack(alignment: .bottom, spacing: 12) {
                    TextEditor(text: Binding(get: { state.composer.body }, set: { state.edit($0) }))
                        .font(.sgmBody(15)).frame(minHeight: 44, maxHeight: 100).scrollContentBackground(.hidden)
                        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: 8))
                        .disabled(!state.canCompose || state.composer.pending != nil)
                        .accessibilityLabel("Message").accessibilityIdentifier("ride-chat.composer")
                    Button { Task { await state.send() } } label: {
                        Image(systemName: state.composer.pending == nil ? "paperplane" : "arrow.clockwise")
                            .frame(width: 44, height: 44).contentShape(Rectangle())
                    }.disabled(!state.canSend).buttonStyle(.plain)
                        .accessibilityLabel(state.composer.pending == nil ? "Envoyer le message" : "Réessayer le même envoi")
                        .help(state.composer.pending == nil ? "Envoyer le message" : "Réessayer le même envoi")
                        .accessibilityIdentifier("ride-chat.send")
                }
            }
        }.foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen).padding(.vertical, 10).background(SGM.bgApp)
    }
}
