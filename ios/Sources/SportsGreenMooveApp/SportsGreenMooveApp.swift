import SwiftUI

@main
struct SportsGreenMooveNativeApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            AppShell()
                .environment(appState)
        }
    }
}
