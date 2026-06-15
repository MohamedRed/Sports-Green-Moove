package be.sportgreenmoove.app.ui

import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag

object SgmTestTags {
    const val AuthScreen = "auth.screen"
    const val AuthEmailAction = "auth.email.action"
    const val AuthError = "auth.error"
    const val AuthFacebookAction = "auth.facebook.action"
    const val AuthGoogleAction = "auth.google.action"
    const val ConfigurationRequired = "configuration.required"
    const val HomeScreen = "home.screen"
    const val GroupsScreen = "groups.screen"
    const val GroupsJoinAction = "groups.join.action"
    const val PublishScreen = "publish.screen"
    const val PublishNextAction = "publish.next.action"
    const val PublishSubmitAction = "publish.submit.action"
    const val SearchScreen = "search.screen"
    const val SearchAction = "search.action"
    const val BookingRequestAction = "booking.request.action"
    const val BookingApproveAction = "booking.approve.action"
    const val ActiveRideScreen = "active-ride.screen"
    const val ActiveRidePickupAction = "active-ride.pickup.action"
    const val ActiveRideDropoffAction = "active-ride.dropoff.action"
    const val ActiveRideEndAction = "active-ride.end.action"
    const val EmergencyContact = "active-ride.emergency-contact"
    const val MessagesScreen = "messages.screen"
    const val ChatTab = "messages.chat.tab"
    const val RatingTab = "messages.rating.tab"
    const val RatingPromptAction = "messages.rating-prompt.action"
    const val ImpactScreen = "impact.screen"
    const val RewardsScreen = "rewards.screen"
    const val RewardsWithdrawAction = "rewards.withdraw.action"
    const val OptionsScreen = "options.screen"
    const val SupportReportAction = "options.support-report.action"
    const val PaymentsScreen = "payments.screen"
    const val PaymentAction = "payments.payment.action"
}

fun Modifier.sgmTestTag(tag: String): Modifier = testTag(tag)

fun Modifier.sgmOptionalTestTag(tag: String?): Modifier =
    if (tag == null) this else testTag(tag)
