import SwiftUI

@MainActor struct RideChatThreadView: View {
    @Environment(\.scenePhase) private var phase
    @State private var state: RideChatThreadState
    @State private var epoch = UUID()
    @State private var frames: [RideChatID: CGRect] = [:]
    @State private var visible = Set<RideChatID>()
    @State private var nearBottom = true
    @State private var positioned = false
    let access: AccountAccess
    let selection: RideChatSelection
    let onBack: () -> Void
    init(uid: RideChatID, selection: RideChatSelection, access: AccountAccess, gateway: any RideChatGateway,
        onBack: @escaping () -> Void) {
        self.access = access; self.selection = selection; self.onBack = onBack
        _state = State(initialValue: RideChatThreadState(uid: uid, reference: selection.reference,
            access: access, gateway: gateway, makeStorage: { try RideChatDraftStore.platformStore() }))
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            RideChatHeader(title: "CONVERSATION", busy: state.busy,
                onBack: { state.close(); onBack() }, onRefresh: { epoch = UUID() })
            if state.live {
                if let error = state.error {
                    Text(error).padding(.horizontal, SGMSpace.padScreen).accessibilityIdentifier("ride-chat.error")
                    Spacer()
                } else {
                    if state.loaded, let context = selection.context {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(context.title).font(.sgmBody(18, weight: .bold))
                            Text(context.departureLabel).font(.sgmBody(13)).foregroundStyle(SGM.textSecondary)
                            if let child = context.childLabel { Text(child).font(.sgmBody(13)) }
                        }.fixedSize(horizontal: false, vertical: true).padding(.horizontal, SGMSpace.padScreen)
                    }
                    if state.hasEarlier {
                        Button("Messages précédents") { Task { await state.earlier() } }
                            .disabled(state.busy).frame(minHeight: 44).padding(.horizontal, SGMSpace.padScreen)
                            .accessibilityIdentifier("ride-chat.earlier")
                    }
                    if let error = state.earlierError { Text(error).padding(.horizontal, SGMSpace.padScreen).accessibilityIdentifier("ride-chat.earlier-error") }
                    history
                    if let error = state.readError {
                        HStack(alignment: .top) {
                            Text(error).font(.sgmBody(13)).frame(maxWidth: .infinity, alignment: .leading)
                            Button("Réessayer") { Task { await state.markVisible(visible, retry: true) } }
                                .disabled(state.busy).frame(minHeight: 44).accessibilityIdentifier("ride-chat.read-retry")
                        }.padding(.horizontal, SGMSpace.padScreen)
                    }
                }
            } else { Spacer() }
        }.background(SGM.bgApp.ignoresSafeArea()).foregroundStyle(SGM.textPrimary).font(.sgmBody(15))
            .safeAreaInset(edge: .bottom) {
                if state.live && state.loaded && state.error == nil { RideChatComposerView(state: state) }
            }
            .task(id: RideChatViewTaskKey(phase: phase, epoch: epoch, waiting: access.waitingForEarlierWork)) {
                state.suspend(); frames = [:]; visible = []; positioned = false
                if phase == .active && !access.waitingForEarlierWork { await state.run() }
            }
            .onChange(of: phase) { _, next in if next != .active { state.suspend(); frames = [:]; visible = [] } }
            .onChange(of: access.isCurrent) { _, current in if !current { state.close(); frames = [:]; visible = [] } }
            .onChange(of: state.busy) { _, busy in if !busy { markVisible() } }
            .onDisappear { state.close(); frames = [:]; visible = [] }
    }
    private var history: some View {
        GeometryReader { viewport in
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if state.busy { ProgressView().accessibilityLabel("Vérification de la conversation") }
                        if state.loaded && state.messages.isEmpty { Text("Aucun message.").accessibilityIdentifier("ride-chat.empty") }
                        ForEach(Array(state.messages.reversed())) { row in
                            RideChatBubble(row: row, mine: row.sender == state.uid, author: state.participants[row.sender] ?? nil).id(row.id)
                                .background(GeometryReader { geometry in
                                    Color.clear.preference(key: RideChatFrames.self,
                                        value: [row.id: geometry.frame(in: .named("ride-chat-messages"))])
                                })
                        }
                    }.padding(.horizontal, SGMSpace.padScreen).padding(.vertical, 12)
                }.coordinateSpace(name: "ride-chat-messages").scrollDismissesKeyboard(.interactively)
                    .accessibilityIdentifier("ride-chat.messages")
                    .accessibilityValue("\(state.messages.count) messages")
                    .onPreferenceChange(RideChatFrames.self) { next in
                        Task { @MainActor in frames = next; updateVisibility(viewport.size) }
                    }
                    .onChange(of: viewport.size) { _, size in updateVisibility(size) }
                    .onChange(of: state.messages.first?.id, initial: true) { _, id in
                        if let id, !positioned || nearBottom { proxy.scrollTo(id, anchor: .bottom); positioned = true }
                    }
            }
        }
    }
    private func updateVisibility(_ size: CGSize) {
        let bounds = CGRect(origin: .zero, size: size)
        visible = Set(frames.filter { _, rect in
            let intersection = rect.intersection(bounds)
            return !intersection.isNull && intersection.width > 0 && intersection.height >= min(rect.height, 24)
        }.keys)
        nearBottom = state.messages.first.flatMap { frames[$0.id] }.map { $0.maxY <= size.height + 40 && $0.maxY > 0 } ?? false
        markVisible()
    }
    private func markVisible() { let ids = visible; Task { await state.markVisible(ids) } }
}
private struct RideChatFrames: PreferenceKey {
    static var defaultValue: [RideChatID: CGRect] { [:] }
    static func reduce(value: inout [RideChatID: CGRect], nextValue: () -> [RideChatID: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, next in next })
    }
}
