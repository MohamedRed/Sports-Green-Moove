import SwiftUI

enum UITestIdentifier {
    static let authScreen = "auth.screen"
    static let authEmailAction = "auth.email.action"
    static let authFacebookAction = "auth.facebook.action"
    static let authGoogleAction = "auth.google.action"
    static let configurationRequired = "configuration.required"
    static let homeScreen = "home.screen"
    static let groupsScreen = "groups.screen"
    static let groupsJoinAction = "groups.join.action"
    static let publishScreen = "publish.screen"
    static let publishNextAction = "publish.next.action"
    static let publishSubmitAction = "publish.submit.action"
    static let searchScreen = "search.screen"
    static let searchAction = "search.action"
    static let bookingRequestAction = "booking.request.action"
    static let bookingApproveAction = "booking.approve.action"
    static let activeRideScreen = "active-ride.screen"
    static let activeRidePickupAction = "active-ride.pickup.action"
    static let activeRideDropoffAction = "active-ride.dropoff.action"
    static let activeRideEndAction = "active-ride.end.action"
    static let emergencyContact = "active-ride.emergency-contact"
    static let messagesScreen = "messages.screen"
    static let chatTab = "messages.chat.tab"
    static let ratingTab = "messages.rating.tab"
    static let ratingPromptAction = "messages.rating-prompt.action"
    static let impactScreen = "impact.screen"
    static let rewardsScreen = "rewards.screen"
    static let rewardsWithdrawAction = "rewards.withdraw.action"
    static let optionsScreen = "options.screen"
    static let supportReportAction = "options.support-report.action"
    static let paymentsScreen = "payments.screen"
    static let paymentAction = "payments.payment.action"
}

extension View {
    @ViewBuilder
    func sgmUITestIdentifier(_ identifier: String?) -> some View {
        if let identifier {
            accessibilityIdentifier(identifier)
        } else {
            self
        }
    }
}
