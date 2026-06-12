import Foundation

#if canImport(Stripe) && canImport(StripePaymentSheet) && canImport(UIKit)
import Stripe
import StripePaymentSheet
import UIKit

@MainActor
enum StripePaymentOutcome: Sendable {
    case completed
    case canceled
}

@MainActor
struct StripePaymentSheetPresenter {
    func present(config: PaymentSheetConfig, from viewController: UIViewController) async throws -> StripePaymentOutcome {
        StripeAPI.defaultPublishableKey = config.publishableKey

        var configuration = PaymentSheet.Configuration()
        configuration.merchantDisplayName = "Sports Green-mOOVe"

        let paymentSheet = PaymentSheet(
            paymentIntentClientSecret: config.clientSecret,
            configuration: configuration
        )

        let result = await paymentSheet.present(from: viewController)
        switch result {
        case .completed:
            return .completed
        case .canceled:
            return .canceled
        case .failed(let error):
            throw error
        }
    }
}
#endif
