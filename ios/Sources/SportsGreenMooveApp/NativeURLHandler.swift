import Foundation

#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

enum NativeURLHandler {
    static func handleOpenURL(_ url: URL) {
        #if canImport(GoogleSignIn)
        GIDSignIn.sharedInstance.handle(url)
        #else
        _ = url
        #endif
    }
}
