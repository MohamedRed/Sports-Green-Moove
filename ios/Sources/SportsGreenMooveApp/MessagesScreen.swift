import SwiftUI

struct MessagesScreen: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = "chats"
    @State private var inbox = InboxSummary()
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        SGMScreen(spacing: 0) {
            SGMTopBar(title: "MESSAGES")
            MessageTabs(tabs: tabs, selected: selectedTab) { selectedTab = $0 }
            VStack(spacing: 10) {
                if loading {
                    MessageEmptyCard(message: "Synchronisation de l'inbox...")
                } else if let error {
                    MessageEmptyCard(message: error)
                } else {
                    switch selectedTab {
                    case "notifs":
                        notificationContent
                    case "avis":
                        reviewContent
                    default:
                        chatContent
                    }
                }
            }
            .padding(.horizontal, SGMSpace.padScreen)
            .padding(.top, 14)
        }
        .task { await loadInbox() }
    }

    private var tabs: [MessageTab] {
        [
            MessageTab(id: "notifs", label: "Notifs", count: inbox.notifications.filter(\.unread).count),
            MessageTab(id: "chats", label: "Chats", count: inbox.chats.reduce(0) { $0 + $1.unreadCount }),
            MessageTab(id: "avis", label: "Avis", count: inbox.reviews.count),
        ]
    }

    private var chatContent: some View {
        Group {
            if inbox.chats.isEmpty {
                MessageEmptyCard(message: "Aucune conversation.")
            } else {
                ForEach(inbox.chats) { ChatCard(chat: $0) }
            }
        }
    }

    private var notificationContent: some View {
        Group {
            if inbox.notifications.isEmpty {
                MessageEmptyCard(message: "Aucune notification.")
            } else {
                ForEach(inbox.notifications) { NotificationCard(notification: $0) }
            }
        }
    }

    private var reviewContent: some View {
        Group {
            if inbox.reviews.isEmpty {
                MessageEmptyCard(message: "Aucun avis en attente.")
            } else {
                ForEach(inbox.reviews) { ReviewCard(review: $0) }
            }
        }
    }

    private func loadInbox() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            inbox = try await appState.firebase.getInbox()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct MessageTab: Identifiable, Hashable {
    let id: String
    let label: String
    let count: Int
}

private struct MessageTabs: View {
    let tabs: [MessageTab]
    let selected: String
    var onSelect: (String) -> Void

    var body: some View {
        HStack(spacing: 6) {
            ForEach(tabs) { tab in
                SGMChip(text: tab.label, selected: selected == tab.id, badge: tab.count > 0 ? "\(tab.count)" : nil) {
                    onSelect(tab.id)
                }
            }
        }
        .padding(.horizontal, SGMSpace.padScreen)
        .padding(.top, 12)
    }
}

private struct ChatCard: View {
    let chat: InboxChatSummary

    var body: some View {
        HStack(spacing: 10) {
            SGMAvatar(initials: chat.initials, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(chat.title)
                    .font(.sgmBody(15, weight: .semibold))
                    .foregroundStyle(SGM.textPrimary)
                    .lineLimit(1)
                Text(chat.preview)
                    .font(.sgmBody(12))
                    .foregroundStyle(SGM.textMuted)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(chat.dateLabel)
                    .font(.sgmBody(10, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
                if chat.unreadCount > 0 {
                    Text("\(chat.unreadCount)")
                        .font(.sgmBody(10, weight: .bold))
                        .foregroundStyle(SGM.textOnGreen)
                        .frame(width: 18, height: 18)
                        .background(SGM.green, in: Circle())
                }
            }
        }
        .messageCardStyle()
    }
}

private struct NotificationCard: View {
    let notification: InboxNotificationSummary

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            SGMAvatar(initials: notification.initials, size: 36, muted: !notification.unread)
            VStack(alignment: .leading, spacing: 3) {
                Text(notification.title)
                    .font(.sgmBody(12, weight: .bold))
                    .tracking(.sgmWide(for: 12))
                    .foregroundStyle(notification.unread ? SGM.green : SGM.textMuted)
                Text(notification.body)
                    .font(.sgmBody(13, weight: notification.unread ? .semibold : .regular))
                    .foregroundStyle(SGM.textPrimary)
                Text(notification.dateLabel)
                    .font(.sgmBody(10, weight: .medium))
                    .foregroundStyle(SGM.textMuted)
            }
            Spacer()
            if notification.unread {
                Circle().fill(SGM.green).frame(width: 8, height: 8).padding(.top, 4)
            }
        }
        .messageCardStyle()
    }
}

private struct ReviewCard: View {
    let review: InboxReviewPrompt

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                SGMAvatar(initials: review.initials, size: 36)
                Text(review.title)
                    .font(.sgmBody(13, weight: .bold))
                    .foregroundStyle(SGM.textPrimary)
            }
            Text(review.prompt)
                .font(.sgmBody(13))
                .foregroundStyle(SGM.textSecondary)
            HStack(spacing: 4) {
                ForEach(0..<5, id: \.self) { _ in
                    SGMIconView(icon: .star, size: 18, color: SGM.orange)
                }
            }
        }
        .messageCardStyle()
    }
}

private struct MessageEmptyCard: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.sgmBody(13, weight: .semibold))
            .foregroundStyle(SGM.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .messageCardStyle()
    }
}

private extension View {
    func messageCardStyle() -> some View {
        padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }
}
