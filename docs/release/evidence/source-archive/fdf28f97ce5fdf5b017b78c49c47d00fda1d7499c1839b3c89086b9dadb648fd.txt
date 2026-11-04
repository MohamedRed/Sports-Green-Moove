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
