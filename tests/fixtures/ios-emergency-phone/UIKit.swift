import Foundation

@MainActor public final class UIApplication {
    public static let shared = UIApplication()
    public private(set) var requests: [URL] = []
    public var accepted = true
    public func open(_ url: URL, options: [String: Any], completionHandler: @escaping @MainActor @Sendable (Bool) -> Void) {
        requests.append(url); completionHandler(accepted)
    }
}
