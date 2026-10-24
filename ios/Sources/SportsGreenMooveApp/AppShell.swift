import SwiftUI

struct AppShell: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if !appState.isConfigured {
                ConfigurationRequiredScreen()
            } else if appState.session == nil {
                AuthScreen()
            } else {
                authenticatedShell
            }
        }
        .background(SGM.bgApp.ignoresSafeArea())
        .task {
            await appState.bootstrap()
        }
        .alert("SPORTS GREEN-mOOVe", isPresented: alertBinding) {
            Button("OK", role: .cancel) {
                appState.errorMessage = nil
                appState.noticeMessage = nil
            }
        } message: {
            Text(appState.errorMessage ?? appState.noticeMessage ?? "")
        }
        .alert(ActiveRidePermissionCopy.title, isPresented: activeRidePermissionBinding) {
            Button(ActiveRidePermissionCopy.cancel, role: .cancel) {
                appState.cancelActiveRideStart()
            }
            Button(ActiveRidePermissionCopy.continueAction) {
                Task {
                    await appState.confirmActiveRideStart()
                }
            }
        } message: {
            Text(ActiveRidePermissionCopy.body)
        }
    }

    private var authenticatedShell: some View {
        ZStack(alignment: .bottom) {
            activeContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            SGMTabBar(
                selected: appState.selectedTab,
                onSelect: { appState.selectTab($0) }
            )
        }
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { appState.errorMessage != nil || appState.noticeMessage != nil },
            set: { visible in
                if !visible {
                    appState.errorMessage = nil
                    appState.noticeMessage = nil
                }
            }
        )
    }

    private var activeRidePermissionBinding: Binding<Bool> {
        Binding(
            get: { appState.activeRidePermissionDisclosure != nil },
            set: { visible in
                if !visible {
                    appState.activeRidePermissionDisclosure = nil
                }
            }
        )
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
        case .payments:
            PaymentsScreen()
        case .ride:
            RideMonitorScreen()
        }
    }
}
