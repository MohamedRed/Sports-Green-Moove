import Foundation

#if canImport(GoogleSignIn)
import GoogleSignIn
#endif
#if canImport(FacebookCore) && canImport(UIKit)
import FacebookCore
import UIKit
#endif

enum NativeFacebookLifecycle {
    static func configureIfAvailable() {
        #if canImport(FacebookCore) && canImport(UIKit)
        ApplicationDelegate.shared.application(UIApplication.shared, didFinishLaunchingWithOptions: nil)
        #endif
    }
}

enum NativeURLHandler {
    static func handleOpenURL(_ url: URL) {
        #if canImport(FacebookCore) && canImport(UIKit)
        if ApplicationDelegate.shared.application(UIApplication.shared, open: url, options: [:]) {
            return
        }
        #endif
        #if canImport(GoogleSignIn)
        GIDSignIn.sharedInstance.handle(url)
        #else
        _ = url
        #endif
    }
}
