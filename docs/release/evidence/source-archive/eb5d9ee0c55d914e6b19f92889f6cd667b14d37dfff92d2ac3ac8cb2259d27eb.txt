protocol StripePaymentsGateway: Sendable {
    var isConfigured: Bool { get }
    func createStripeAccount(email: String) async throws -> StripeConnectAccount
    func createStripeAccountLink(returnUrl: String, refreshUrl: String) async throws -> StripeConnectAccountLink
    func prepareRidePayment(bookingId: String) async throws -> PaymentSheetConfig
    func ridePaymentStatus(bookingId: String, paymentIntentId: String) async throws -> RidePaymentState
}
