import Foundation
import Observation

@MainActor @Observable final class SearchSelectionState {
    var form = SearchFormState.initial() {
        didSet { if form != oldValue && access.isCurrent { appState.invalidateSearch() } }
    }
    var originInput = "" {
        didSet { if originInput != oldValue && access.isCurrent { appState.invalidatePlace(.origin) } }
    }
    var destinationInput = "" {
        didSet { if destinationInput != oldValue && access.isCurrent { appState.invalidatePlace(.destination) } }
    }
    private let appState: AppState
    private let access: AccountAccess

    init(appState: AppState, access: AccountAccess) {
        self.appState = appState
        self.access = access
    }

    func reconcileChildren(_ children: [ChildSummary]) {
        guard !children.contains(where: { $0.id == form.childUserId }) else { return }
        form.childUserId = children.first?.id
    }

    func reset(children: [ChildSummary]) {
        form = .initial()
        originInput = ""
        destinationInput = ""
        reconcileChildren(children)
    }
}
