import SwiftUI

struct AppShell: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if !appState.isConfigured {
                ConfigurationRequiredScreen()
            } else if let access = appState.accountAccess {
                authenticatedShell(access)
                    .id(access.context.id)
            } else {
                AuthScreen()
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

    private func authenticatedShell(_ access: AccountAccess) -> some View {
        VStack(spacing: 0) {
            activeContent(access)
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
    private func activeContent(_ access: AccountAccess) -> some View {
        if let overlay = appState.overlay {
            overlayContent(overlay, access: access)
        } else {
            tabContent(appState.selectedTab, access: access)
        }
    }

    @ViewBuilder
    private func tabContent(_ tab: AppTab, access: AccountAccess) -> some View {
        switch tab {
        case .home:
            HomeScreen(access: access)
        case .trips:
            TripsScreen(access: access)
        case .publish:
            PublishScreen(access: access)
        case .messages:
            MessagesScreen()
        case .profile:
            ProfileScreen()
        }
    }

    @ViewBuilder
    private func overlayContent(_ overlay: AppOverlay, access: AccountAccess) -> some View {
        switch overlay {
        case .search:
            SearchScreen(access: access)
        case .groups:
            GroupsScreen()
        case .impact:
            ImpactScreen()
        case .rewards:
            RewardsScreen()
        case .options:
            OptionsScreen()
        case .payments:
            PaymentsScreen(access: access)
        case .ride:
            RideMonitorScreen()
        }
    }
}
