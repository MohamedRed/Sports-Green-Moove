import SwiftUI

struct MessagesScreen: View {
    @Environment(AppState.self) private var appState
    var body: some View {
        if let access = appState.accountAccess {
            OwnedMessagesScreen(access: access, gateway: appState.firebase).id(access.context.id)
        }
    }
}

private struct OwnedMessagesScreen: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedTab = "chats"
    @State private var state: MessagesInboxState

    init(access: AccountAccess, gateway: any MessagesGateway) {
        _state = State(initialValue: MessagesInboxState(access: access, gateway: gateway))
    }

    var body: some View {
        SGMScreen(spacing: 0, testID: UITestIdentifier.messagesScreen) {
            HStack {
                SGMTopBar(title: "MESSAGES")
                Button { Task { await state.refresh() } } label: {
                    Image(systemName: "arrow.clockwise").frame(width: 44, height: 44)
                }.accessibilityLabel("Actualiser les messages").accessibilityIdentifier("messages.refresh")
                    .disabled(state.busy || !state.live).padding(.trailing, SGMSpace.padScreen)
            }
            MessageTabs(tabs: tabs, selected: selectedTab) { selectedTab = $0 }
            VStack(spacing: 10) {
                if state.live {
                    if state.loading { ProgressView().accessibilityLabel("Chargement des messages") }
                    if let error = state.error { MessageEmptyCard(message: error) }
                    if let notice = state.notice {
                        MessageEmptyCard(message: notice)
                    }
                    if !state.loading && state.inbox.reviewsUserId != nil {
                        switch selectedTab {
                        case "notifs":
                            notificationContent
                        case "avis":
                            PendingReviewsContent(state: state.reviews, submittingId: state.submittingReviewId,
                                busy: !state.canSubmit, onMore: { Task { await state.more() } }) { review, score in
                                Task { await state.submit(review, score: score) }
                            }
                        default:
                            chatContent
                        }
                    }
                }
            }
            .padding(.horizontal, SGMSpace.padScreen)
            .padding(.top, 14)
        }
        .task(id: scenePhase) { if scenePhase == .active { await state.resume() } else { state.suspend() } }
        .onChange(of: scenePhase) { _, phase in if phase != .active { state.suspend() } }
        .onDisappear { state.close() }
    }

    private var tabs: [MessageTab] {
        [
            MessageTab(id: "notifs", label: "Notifs", count: state.live ? state.inbox.notifications.filter(\.unread).count : 0),
            MessageTab(id: "chats", label: "Chats", count: state.live ? state.inbox.chats.reduce(0) { $0 + $1.unreadCount } : 0),
            MessageTab(id: "avis", label: "Avis", count: state.live ? state.reviews.items.count : 0),
        ]
    }

    private var chatContent: some View {
        Group {
            if state.inbox.chats.isEmpty {
                MessageEmptyCard(message: "Aucune conversation.")
            } else {
                ForEach(state.inbox.chats) { ChatCard(chat: $0) }
            }
        }
    }

    private var notificationContent: some View {
        Group {
            if state.inbox.notifications.isEmpty {
                MessageEmptyCard(message: "Aucune notification.")
            } else {
                ForEach(state.inbox.notifications) { NotificationCard(notification: $0) }
            }
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
                SGMChip(text: tab.label, selected: selected == tab.id, badge: tab.count > 0 ? "\(tab.count)" : nil, testID: tab.testID) {
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

struct ReviewCard: View {
    let review: InboxReviewPrompt
    let submitting: Bool
    let onRate: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                SGMAvatar(initials: review.initials, size: 36)
                Text(review.title)
                    .font(.sgmBody(13, weight: .bold))
                    .foregroundStyle(SGM.textPrimary)
            }
            if let trip = review.tripContext {
                VStack(alignment: .leading, spacing: 4) {
                    Text(trip.title).font(.sgmBody(14, weight: .semibold)).foregroundStyle(SGM.textPrimary)
                    Text(trip.departureLabel).font(.sgmBody(13)).foregroundStyle(SGM.textSecondary)
                }
            } else {
                Text("Détails du trajet indisponibles").font(.sgmBody(13)).foregroundStyle(SGM.textSecondary)
            }
            Text(review.prompt)
                .font(.sgmBody(13))
                .foregroundStyle(SGM.textSecondary)
            if submitting {
                Text("Envoi de l'avis...")
                    .font(.sgmBody(11, weight: .semibold))
                    .foregroundStyle(SGM.textMuted)
            }
            HStack(spacing: 4) {
                ForEach(1...5, id: \.self) { score in
                    Button {
                        onRate(score)
                    } label: {
                        SGMIconView(icon: .star, size: 18, color: SGM.orange)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Noter \(score) étoile\(score == 1 ? "" : "s")")
                    .disabled(submitting)
                    .sgmUITestIdentifier("\(UITestIdentifier.ratingPromptAction).\(score)")
                }
            }
        }
        .messageCardStyle()
        .accessibilityElement(children: .contain)
        .sgmUITestIdentifier(UITestIdentifier.ratingPromptAction)
    }
}

private extension MessageTab {
    var testID: String? {
        switch id {
        case "chats": UITestIdentifier.chatTab
        case "avis": UITestIdentifier.ratingTab
        default: nil
        }
    }
}

struct MessageEmptyCard: View {
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
