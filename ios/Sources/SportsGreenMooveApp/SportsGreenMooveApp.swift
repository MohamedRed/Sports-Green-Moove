import SwiftUI

@main
struct SportsGreenMooveNativeApp: App {
    @State private var appState = AppState()

    init() {
        SGMFontRegistrar.registerFonts()
    }

    var body: some Scene {
        WindowGroup {
            AppShell()
                .environment(appState)
                .preferredColorScheme(appState.darkTheme ? .dark : .light)
        }
    }
}
