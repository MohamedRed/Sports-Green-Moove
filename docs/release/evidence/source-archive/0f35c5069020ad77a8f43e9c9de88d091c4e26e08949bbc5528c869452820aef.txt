import SwiftUI

struct TeamChatBubble: View {
    let row: TeamChatMessage
    let uid: String
    var body: some View {
        HStack {
            if row.senderId == uid { Spacer(minLength: 24) }
            VStack(alignment: .leading, spacing: 6) {
                Text(row.senderId == uid ? "Vous" : row.author ?? "Nom indisponible").font(.sgmBody(12, weight: .bold))
                Text(row.body).font(.sgmBody(15)).fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
                    .accessibilityIdentifier("team-chat.message.\(row.id)")
                Text(Date(timeIntervalSince1970: Double(row.seconds)).formatted(date: .abbreviated, time: .shortened))
                    .font(.sgmBody(11)).foregroundStyle(SGM.textSecondary)
            }.padding(12).background(row.senderId == uid ? SGM.green.opacity(0.12) : SGM.bgCard,
                in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            if row.senderId != uid { Spacer(minLength: 24) }
        }.foregroundStyle(SGM.textPrimary)
    }
}

struct TeamChatComposerView: View {
    let state: TeamChatState
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let error = state.composer.error { Text(error).font(.sgmBody(13)).accessibilityIdentifier("team-chat.send-error") }
            if state.title == nil { Text("Nom de l’équipe indisponible.").font(.sgmBody(13)) }
            if !state.composer.loaded {
                Button("Recharger le brouillon") { state.retryDraft() }.frame(minHeight: 44)
                    .accessibilityIdentifier("team-chat.draft-retry")
            } else {
                HStack(alignment: .bottom, spacing: 12) {
                    TextEditor(text: Binding(get: { state.composer.body }, set: { state.edit($0) }))
                        .font(.sgmBody(15)).frame(minHeight: 44, maxHeight: 100).scrollContentBackground(.hidden)
                        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: 8))
                        .disabled(!state.canCompose || state.composer.pending != nil)
                        .accessibilityLabel("Message").accessibilityIdentifier("team-chat.composer")
                    Button { Task { await state.send(); await state.refresh() } } label: {
                        Image(systemName: state.composer.pending == nil ? "paperplane" : "arrow.clockwise").frame(width: 44, height: 44)
                    }.disabled(!state.canSend).buttonStyle(.plain)
                        .accessibilityLabel(state.composer.pending == nil ? "Envoyer le message" : "Réessayer le même envoi")
                        .help(state.composer.pending == nil ? "Envoyer le message" : "Réessayer le même envoi")
                        .accessibilityIdentifier("team-chat.send")
                }
            }
        }.foregroundStyle(SGM.textPrimary).padding(.horizontal, SGMSpace.padScreen).padding(.vertical, 10)
            .background(SGM.bgApp)
    }
}
