import Foundation
import CoreFoundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

struct FirebaseStripePaymentsGateway: StripePaymentsGateway {
    let isConfigured = true

    func createStripeAccount(email: String) async throws -> StripeConnectAccount {
        try await paymentCall(name: "createStripeAccount", input: ["email": email]) { payload in
            guard let accountId = payload["id"] as? String, !accountId.isEmpty else {
                throw ProviderConfigurationError(message: "Réponse compte Stripe invalide.")
            }
            return StripeConnectAccount(accountId: accountId, reused: payload["reused"] as? Bool ?? false)
        }
    }

    func createStripeAccountLink(returnUrl: String, refreshUrl: String) async throws -> StripeConnectAccountLink {
        try await paymentCall(name: "createStripeAccountLink", input: ["returnUrl": returnUrl, "refreshUrl": refreshUrl]) { payload in
            guard let url = payload["url"] as? String, !url.isEmpty else {
                throw ProviderConfigurationError(message: "Réponse onboarding Stripe invalide.")
            }
            return StripeConnectAccountLink(url: url, expiresAt: payload["expiresAt"] as? String)
        }
    }

    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig {
        try await paymentCall(name: "createRidePaymentIntent", input: ["bookingId": bookingId]) { payload in
            try mapPaymentSheetConfig(payload)
        }
    }
}

extension FirebaseStripePaymentsGateway {
    func ridePaymentStatus(bookingId: String, paymentIntentId: String) async throws -> RidePaymentState {
        try await paymentCall(name: "getRidePaymentStatus", input: ["bookingId": bookingId, "paymentIntentId": paymentIntentId]) { payload in
            try mapRidePaymentState(payload, bookingId: bookingId, paymentIntentId: paymentIntentId)
        }
    }

    private func paymentCall<Response: Sendable>(name: String, input: [String: String],
        decode: @escaping @Sendable ([String: Any]) throws -> Response) async throws -> Response {
        guard let uid = Auth.auth().currentUser?.uid else { throw CancellationError() }
        return try await firebaseOwnedCall(uid: uid, name: name, input: input) { value in
            guard let payload = value as? [String: Any] else {
                throw ProviderConfigurationError(message: "Réponse paiement invalide.")
            }
            return try decode(payload)
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
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
    let amount = number.doubleValue
    guard amount.isFinite, amount > 0, amount <= Double(Int32.max), amount.rounded(.towardZero) == amount else { return nil }
    return Int(amount)
}
#endif
