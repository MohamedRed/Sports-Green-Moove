import SwiftUI

struct AppShell: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        ZStack(alignment: .bottom) {
            activeContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            SGMTabBar(
                selected: appState.selectedTab,
                onSelect: { appState.selectTab($0) }
            )
        }
        .background(SGM.bgApp.ignoresSafeArea())
        .task {
            await appState.loadTrips()
        }
    }

    @ViewBuilder
    private var activeContent: some View {
        if let overlay = appState.overlay {
            overlayContent(overlay)
        } else {
            tabContent(appState.selectedTab)
        }
    }

    @ViewBuilder
    private func tabContent(_ tab: AppTab) -> some View {
        switch tab {
        case .home:
            HomeScreen()
        case .trips:
            TripsScreen()
        case .publish:
            PublishScreen()
        case .messages:
            MessagesScreen()
        case .profile:
            ProfileScreen()
        }
    }

    @ViewBuilder
    private func overlayContent(_ overlay: AppOverlay) -> some View {
        switch overlay {
        case .search:
            SearchScreen()
        case .groups:
            GroupsScreen()
        case .impact:
            ImpactScreen()
        case .rewards:
            RewardsScreen()
        case .options:
            OptionsScreen()
        case .ride:
            RideMonitorScreen()
        }
    }
}
