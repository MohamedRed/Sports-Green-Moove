import Foundation

#if canImport(FirebaseFunctions)
import FirebaseFunctions

struct FirebaseStripePaymentsGateway: StripePaymentsGateway {
    let isConfigured = true

    func createStripeAccount(email: String) async throws -> StripeConnectAccount {
        try await withCheckedThrowingContinuation { continuation in
            Functions.functions()
                .httpsCallable("createStripeAccount")
                .call(["email": email]) { result, error in
                    if let error {
                        continuation.resume(throwing: error)
                        return
                    }

                    guard let payload = result?.data as? [String: Any],
                          let accountId = payload["id"] as? String
                    else {
                        continuation.resume(throwing: ProviderConfigurationError(message: "Réponse compte Stripe invalide."))
                        return
                    }

                    continuation.resume(returning: StripeConnectAccount(
                        accountId: accountId,
                        reused: payload["reused"] as? Bool ?? false
                    ))
                }
        }
    }

    func createStripeAccountLink(returnUrl: String, refreshUrl: String) async throws -> StripeConnectAccountLink {
        try await withCheckedThrowingContinuation { continuation in
            Functions.functions()
                .httpsCallable("createStripeAccountLink")
                .call(["returnUrl": returnUrl, "refreshUrl": refreshUrl]) { result, error in
                    if let error {
                        continuation.resume(throwing: error)
                        return
                    }

                    guard let payload = result?.data as? [String: Any],
                          let url = payload["url"] as? String
                    else {
                        continuation.resume(throwing: ProviderConfigurationError(message: "Réponse onboarding Stripe invalide."))
                        return
                    }

                    continuation.resume(returning: StripeConnectAccountLink(
                        url: url,
                        expiresAt: payload["expiresAt"] as? String
                    ))
                }
        }
    }

    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig {
        try await withCheckedThrowingContinuation { continuation in
            Functions.functions()
                .httpsCallable("createRidePaymentIntent")
                .call(["bookingId": bookingId]) { result, error in
                    if let error {
                        continuation.resume(throwing: error)
                        return
                    }

                    guard let payload = result?.data as? [String: Any] else {
                        continuation.resume(throwing: ProviderConfigurationError(message: "Réponse paiement invalide."))
                        return
                    }

                    do {
                        continuation.resume(returning: try mapPaymentSheetConfig(payload))
                    } catch {
                        continuation.resume(throwing: error)
                    }
                }
        }
    }
}

private func mapPaymentSheetConfig(_ payload: [String: Any]) throws -> PaymentSheetConfig {
    guard let bookingId = payload["bookingId"] as? String,
          let paymentIntentId = payload["paymentIntentId"] as? String,
          let clientSecret = payload["clientSecret"] as? String,
          let publishableKey = payload["publishableKey"] as? String,
          let amountCents = intValue(payload["amountCents"]),
          let currency = payload["currency"] as? String
    else {
        throw ProviderConfigurationError(message: "Configuration PaymentSheet incomplète.")
    }

    return PaymentSheetConfig(
        bookingId: bookingId,
        paymentIntentId: paymentIntentId,
        clientSecret: clientSecret,
        publishableKey: publishableKey,
        amountCents: amountCents,
        currency: currency
    )
}

private func intValue(_ value: Any?) -> Int? {
    if let int = value as? Int { return int }
    if let number = value as? NSNumber { return number.intValue }
    if let double = value as? Double { return Int(double) }
    return nil
}
#endif
