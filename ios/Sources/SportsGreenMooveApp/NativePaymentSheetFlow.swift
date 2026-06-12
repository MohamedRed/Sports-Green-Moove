import Foundation

#if canImport(UIKit)
import UIKit
#endif

@MainActor
enum NativePaymentSheetFlow {
    static func present(config: PaymentSheetConfig) async throws -> StripePaymentOutcome {
        #if canImport(Stripe) && canImport(StripePaymentSheet) && canImport(UIKit)
        guard let viewController = UIApplication.shared.sgmTopViewController else {
            throw ProviderConfigurationError(message: "Fenêtre iOS indisponible pour Stripe PaymentSheet.")
        }
        return try await StripePaymentSheetPresenter().present(config: config, from: viewController)
        #else
        _ = config
        throw ProviderConfigurationError(message: "Stripe PaymentSheet iOS n'est pas configuré.")
        #endif
    }
}

#if canImport(UIKit)
private extension UIApplication {
    var sgmTopViewController: UIViewController? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }?
            .rootViewController?
            .sgmTopPresentedController
    }
}

private extension UIViewController {
    var sgmTopPresentedController: UIViewController {
        if let presentedViewController {
            return presentedViewController.sgmTopPresentedController
        }
        if let navigationController = self as? UINavigationController {
            return navigationController.visibleViewController?.sgmTopPresentedController ?? navigationController
        }
        if let tabBarController = self as? UITabBarController {
            return tabBarController.selectedViewController?.sgmTopPresentedController ?? tabBarController
        }
        return self
    }
}
#endif
