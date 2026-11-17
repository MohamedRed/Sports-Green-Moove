import SwiftUI

@main
struct SportsGreenMooveNativeApp: App {
    @State private var appState: AppState

    init() {
        #if DEBUG
        if UITestAppStateFactory.isEnabled { UITestBootDiagnostics.record("begin") }
        #endif
        SGMFontRegistrar.registerFonts()
        #if DEBUG
        if UITestAppStateFactory.isEnabled {
            UITestBootDiagnostics.record("fonts-ready")
            _appState = State(initialValue: UITestAppStateFactory.make())
            UITestBootDiagnostics.record("fixture-state-ready")
            return
        }
        #endif
        NativeFacebookLifecycle.configureIfAvailable()
        NativeGoogleMapsLifecycle.configureIfAvailable()
        _appState = State(initialValue: AppRuntime.makeAppState())
    }

    var body: some Scene {
        WindowGroup {
            AppShell()
                .environment(appState)
                .preferredColorScheme(appState.darkTheme ? .dark : .light)
                .onAppear {
                    #if DEBUG
                    if UITestAppStateFactory.isEnabled { UITestBootDiagnostics.record("window-ready") }
                    #endif
                }
                .onOpenURL { url in
                    NativeURLHandler.handleOpenURL(url)
                }
        }
    }
}
