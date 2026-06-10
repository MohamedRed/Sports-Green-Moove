import SwiftUI

struct AppShell: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        TabView(selection: binding) {
            ForEach(AppTab.allCases) { tab in
                NavigationStack {
                    tabContent(tab)
                        .inlineNavigationTitleWhenAvailable()
                }
                .tabItem {
                    Label(tab.title, systemImage: tab.systemImage)
                }
                .tag(tab)
            }
        }
        .tint(SGMColor.green)
        .task {
            await appState.loadTrips()
        }
    }

    private var binding: Binding<AppTab> {
        Binding(
            get: { appState.selectedTab },
            set: { appState.selectedTab = $0 }
        )
    }

    @ViewBuilder
    private func tabContent(_ tab: AppTab) -> some View {
        switch tab {
        case .home:
            HomeView()
        case .greenList:
            GreenListView()
        case .publish:
            PublishTripView()
        case .search:
            SearchTripsView()
        case .notifications:
            NotificationsView()
        case .co2:
            ImpactView()
        case .rewards:
            RewardsView()
        case .options:
            OptionsView()
        }
    }
}

struct AppHeader: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: SGMSpacing.x2) {
            HStack {
                Wordmark(compact: true)
                Spacer()
                Picker("Role", selection: roleBinding) {
                    ForEach(AppRole.allCases) { role in
                        Text(role.rawValue).tag(role)
                    }
                }
                .labelsHidden()
                .pickerStyle(.menu)
            }

            Text("COVOITURAGE SPORTIF & CULTUREL")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.1)
                .foregroundStyle(SGMColor.green)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, SGMSpacing.x5)
        .padding(.top, SGMSpacing.x4)
    }

    private var roleBinding: Binding<AppRole> {
        Binding(
            get: { appState.selectedRole },
            set: { appState.selectedRole = $0 }
        )
    }
}

private extension View {
    @ViewBuilder
    func inlineNavigationTitleWhenAvailable() -> some View {
        #if os(iOS)
        self.navigationBarTitleDisplayMode(.inline)
        #else
        self
        #endif
    }
}
