import Foundation

@MainActor
enum StripePaymentOutcome: Sendable {
    case completed
    case canceled
}

#if canImport(Stripe) && canImport(StripePaymentSheet) && canImport(UIKit)
import Stripe
import StripePaymentSheet
import UIKit

@MainActor
struct StripePaymentSheetPresenter {
    func present(config: PaymentSheetConfig, from viewController: UIViewController) async throws -> StripePaymentOutcome {
        var configuration = PaymentSheet.Configuration()
        configuration.apiClient = STPAPIClient(publishableKey: config.publishableKey)
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
