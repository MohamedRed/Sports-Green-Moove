import Foundation

func checkRidePaymentVerification() throws {
    let config = PaymentSheetConfig(bookingId: "booking", paymentIntentId: "pi_owned", clientSecret: "synthetic_secret",
                                    publishableKey: "pk_test_synthetic", amountCents: 400, currency: "eur")
    let target = try RidePaymentTarget(ownerUid: "parent", bookingId: "booking", amountCents: 400, config: config)
    check(target.ownerUid == "parent" && target.paymentIntentId == "pi_owned", "Payment target lost its owner")
    for (owner, booking, amount) in [("", "booking", 400), ("parent", "other", 400), ("parent", "booking", 401)] {
        do { _ = try RidePaymentTarget(ownerUid: owner, bookingId: booking, amountCents: amount, config: config); fatalError("Unrelated checkout accepted") }
        catch is ProviderConfigurationError {}
    }
    let base = ["bookingId": "booking", "paymentIntentId": "pi_owned", "state": "recorded"]
    let confirmed = try mapRidePaymentState(base, bookingId: "booking", paymentIntentId: "pi_owned")
    check(confirmed == .recorded, "Recorded payment state changed")
    for (key, value) in [("bookingId", "other"), ("paymentIntentId", "pi_other"), ("state", "completed")] {
        var payload = base; payload[key] = value
        do { _ = try mapRidePaymentState(payload, bookingId: "booking", paymentIntentId: "pi_owned"); fatalError("Unrelated status accepted") }
        catch is ProviderConfigurationError {}
    }
    print("RidePaymentChecks passed")
}
