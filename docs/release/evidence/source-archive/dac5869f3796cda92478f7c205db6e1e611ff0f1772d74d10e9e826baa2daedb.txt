import SwiftUI

struct TeamChatThreadView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: TeamChatState
    @State private var epoch = UUID()
    @State private var frames: [String: CGRect] = [:]
    @State private var visible: Set<String> = []
    @State private var nearBottom = true
    @State private var positioned = false
    let onBack: () -> Void
    init(access: AccountAccess, target: TeamChatTarget, gateway: any TeamChatGateway, onBack: @escaping () -> Void) {
        _state = State(initialValue: TeamChatState(access: access, target: target, gateway: gateway,
            makeStorage: { try TeamChatDraftStore.platformStore() }))
        self.onBack = onBack
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TeamChatHeader(title: "ÉQUIPE", busy: state.busy, back: { state.close(); onBack() }, refresh: { epoch = UUID() })
            if state.live {
                if let title = state.title {
                    Text(title).font(.sgmBody(18, weight: .bold)).fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, SGMSpace.padScreen).accessibilityIdentifier("team-chat.title")
                }
                if let error = state.error {
                    Text(error).padding(.horizontal, SGMSpace.padScreen).accessibilityIdentifier("team-chat.error")
                    Spacer()
                } else {
                    history
                    if let error = state.readError {
                        HStack(alignment: .top) {
                            Text(error).font(.sgmBody(13)).frame(maxWidth: .infinity, alignment: .leading)
                            Button("Réessayer") { Task { await state.markVisible(visible, retry: true) } }
                                .disabled(state.busy).accessibilityIdentifier("team-chat.read-retry")
                        }.padding(.horizontal, SGMSpace.padScreen)
                    }
                }
            } else { Spacer() }
        }.background(SGM.bgApp.ignoresSafeArea()).foregroundStyle(SGM.textPrimary)
            .font(.sgmBody(15))
            .safeAreaInset(edge: .bottom) {
                if state.live && state.loaded && state.error == nil {
                    TeamChatComposerView(state: state)
                }
            }
            .task(id: TeamChatPollingKey(phase: scenePhase, epoch: epoch)) {
                guard scenePhase == .active else { state.suspend(); return }
                await state.resume()
                while state.live && state.error == nil && !Task.isCancelled {
                    do { try await Task.sleep(for: .seconds(4)) } catch { return }
                    await state.refresh()
                }
            }
            .onChange(of: scenePhase) { _, phase in if phase != .active { state.suspend(); visible = []; frames = [:] } }
            .onChange(of: state.busy) { _, busy in if !busy { markVisible() } }
            .onDisappear { state.close() }
    }
    private var history: some View {
        GeometryReader { viewport in
            let size = viewport.size
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if state.busy { ProgressView().accessibilityLabel("Vérification de la conversation") }
                        if state.hasEarlier {
                            Button("Messages précédents") {
                                let anchor = frames.filter { visible.contains($0.key) }.min { $0.value.minY < $1.value.minY }?.key
                                Task { await state.earlier(); if let anchor { proxy.scrollTo(anchor, anchor: .top) } }
                            }.disabled(state.busy).frame(minHeight: 44).accessibilityIdentifier("team-chat.earlier")
                        }
                        if state.loaded && state.messages.isEmpty { Text("Aucun message.").accessibilityIdentifier("team-chat.empty") }
                        ForEach(Array(state.messages.reversed())) { row in
                            TeamChatBubble(row: row, uid: state.uid).id(row.id)
                                .background(GeometryReader { geometry in
                                    Color.clear.preference(key: TeamChatFrames.self,
                                        value: [row.id: geometry.frame(in: .named("team-chat-messages"))])
                                })
                        }
                    }.padding(.horizontal, SGMSpace.padScreen).padding(.vertical, 12)
                }.coordinateSpace(name: "team-chat-messages").scrollDismissesKeyboard(.interactively)
                    .accessibilityIdentifier("team-chat.messages")
                    .onPreferenceChange(TeamChatFrames.self) { next in
                        Task { @MainActor in
                            frames = next
                            let bounds = CGRect(origin: .zero, size: size)
                            visible = Set(next.filter { _, rect in
                                let intersection = rect.intersection(bounds)
                                return !intersection.isNull && intersection.width > 0 && intersection.height >= min(rect.height, 24)
                            }.keys)
                            nearBottom = state.messages.first.flatMap { next[$0.id] }.map { $0.maxY <= bounds.height + 40 && $0.maxY > 0 } ?? false
                            markVisible()
                        }
                    }
                    .onChange(of: state.messages.first?.id, initial: true) { _, id in
                        if let id, !positioned || nearBottom { proxy.scrollTo(id, anchor: .bottom); positioned = true }
                    }
            }
        }
    }
    private func markVisible() { let ids = visible; Task { await state.markVisible(ids) } }
}

private struct TeamChatPollingKey: Equatable { let phase: ScenePhase; let epoch: UUID }
private struct TeamChatFrames: PreferenceKey {
    static var defaultValue: [String: CGRect] { [:] }
    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) { value.merge(nextValue(), uniquingKeysWith: { _, next in next }) }
}
