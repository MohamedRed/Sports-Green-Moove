import SwiftUI

@main
struct SportsGreenMooveNativeApp: App {
    @State private var appState: AppState

    init() {
        SGMFontRegistrar.registerFonts()
        NativeFacebookLifecycle.configureIfAvailable()
        NativeGoogleMapsLifecycle.configureIfAvailable()
        #if DEBUG
        if UITestAppStateFactory.isEnabled {
            _appState = State(initialValue: UITestAppStateFactory.make())
            return
        }
        #endif
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
