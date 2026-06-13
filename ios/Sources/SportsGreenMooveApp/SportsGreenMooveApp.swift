import SwiftUI

@main
struct SportsGreenMooveNativeApp: App {
    @State private var appState: AppState

    init() {
        SGMFontRegistrar.registerFonts()
        NativeFacebookLifecycle.configureIfAvailable()
        _appState = State(initialValue: AppRuntime.makeAppState())
    }

    var body: some Scene {
        WindowGroup {
            AppShell()
                .environment(appState)
                .preferredColorScheme(appState.darkTheme ? .dark : .light)
                .onOpenURL { url in
                    NativeURLHandler.handleOpenURL(url)
                }
        }
    }
}
