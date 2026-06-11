import SwiftUI

struct MessagesScreen: View {
    @State private var selectedTab = "chats"

    var body: some View {
        SGMScreen(spacing: 0) {
            SGMTopBar(title: "MESSAGES")
            MessageTabs(selected: selectedTab) { selectedTab = $0 }
            VStack(spacing: 10) {
                switch selectedTab {
                case "notifs":
                    NotificationCard(initials: "NT", date: "30-10-2022", message: "Vous avez un nouveau message de Nadège TOUSSAINT", unread: true)
                    NotificationCard(initials: "IB", date: "14-11-2022", message: "Comment s'est passé votre voyage avec Idriss BAMAKO? Donnez-nous votre avis.", unread: false)
                case "avis":
                    ReviewCard()
                default:
                    ChatCard(initials: "IB", name: "Idriss BAMAKO", preview: "parfait on fait comme ça !", date: "29-10-2022", unread: 2)
                    ChatCard(initials: "NT", name: "Nadège TOUSSAINT", preview: "Il finit l'étude à 16h45, ça ira !", date: "02-11-2022", unread: 1)
                    ChatCard(initials: "NC", name: "Nino CASTELUC CI", preview: "Merci Olivier, mon enfant est c...", date: "05-11-2022", unread: 0)
                }
            }
            .padding(.horizontal, SGMSpace.padScreen)
            .padding(.top, 14)
        }
    }
}

private struct MessageTabs: View {
    let selected: String
    var onSelect: (String) -> Void

    var body: some View {
        HStack(spacing: 6) {
            SGMChip(text: "Notifs", selected: selected == "notifs", badge: "1") { onSelect("notifs") }
            SGMChip(text: "Chats", selected: selected == "chats", badge: "3") { onSelect("chats") }
            SGMChip(text: "Avis", selected: selected == "avis", badge: "1") { onSelect("avis") }
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.top, 12)
        .padding(.bottom, 0)
    }
}

private struct ChatCard: View {
    let initials: String
    let name: String
    let preview: String
    let date: String
    let unread: Int

    var body: some View {
        HStack(spacing: 10) {
            SGMAvatar(initials: initials, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.sgmBody(15, weight: .semibold))
                    .foregroundStyle(SGM.textPrimary)
                    .lineLimit(1)
                Text(preview)
                    .font(.sgmBody(12))
                    .foregroundStyle(SGM.textMuted)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(date)
                    .font(.sgmBody(10, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
                if unread > 0 {
                    Text("\(unread)")
                        .font(.sgmBody(10, weight: .bold))
                        .foregroundStyle(SGM.textOnGreen)
                        .frame(width: 18, height: 18)
                        .background(SGM.green, in: Circle())
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct NotificationCard: View {
    let initials: String
    let date: String
    let message: String
    let unread: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            SGMAvatar(initials: initials, size: 36, muted: !unread)
            VStack(alignment: .leading, spacing: 3) {
                Text(date)
                    .font(.sgmBody(12, weight: .bold))
                    .tracking(.sgmWide(for: 12))
                    .foregroundStyle(unread ? SGM.green : SGM.textMuted)
                Text(message)
                    .font(.sgmBody(13, weight: unread ? .semibold : .regular))
                    .foregroundStyle(SGM.textPrimary)
            }
            Spacer()
            if unread {
                Circle()
                    .fill(SGM.green)
                    .frame(width: 8, height: 8)
                    .padding(.top, 4)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}

private struct ReviewCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                SGMAvatar(initials: "IB", size: 36)
                Text("Idriss BAMAKO")
                    .font(.sgmBody(13, weight: .bold))
                    .foregroundStyle(SGM.textPrimary)
            }
            Text("Comment s'est passé votre voyage avec Idriss BAMAKO, papa de Moussa U8 Nationaux?")
                .font(.sgmBody(13))
                .foregroundStyle(SGM.textSecondary)
            HStack(spacing: 4) {
                ForEach(0..<5, id: \.self) { _ in
                    SGMIconView(icon: .star, size: 18, color: SGM.orange)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}
