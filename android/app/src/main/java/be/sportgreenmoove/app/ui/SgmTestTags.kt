package be.sportgreenmoove.app.ui

import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag

object SgmTestTags {
    const val AuthScreen = "auth.screen"
    const val AuthNameInput = "auth.name.input"
    const val AuthEmailInput = "auth.email.input"
    const val AuthPasswordInput = "auth.password.input"
    const val AuthEmailAction = "auth.email.action"
    const val AuthError = "auth.error"
    const val AuthFacebookAction = "auth.facebook.action"
    const val AuthGoogleAction = "auth.google.action"
    const val ConfigurationRequired = "configuration.required"
    const val HomeScreen = "home.screen"
    const val HomeRideAction = "home.ride.action"
    const val HomeTripsAction = "home.trips.action"
    const val HomeImpactAction = "home.impact.action"
    const val GroupsScreen = "groups.screen"
    const val GroupsJoinAction = "groups.join.action"
    const val PublishScreen = "publish.screen"
    const val PublishNextAction = "publish.next.action"
    const val PublishSubmitAction = "publish.submit.action"
    const val SearchScreen = "search.screen"
    const val SearchAction = "search.action"
    const val BookingRequestAction = "booking.request.action"
    const val GuardianConsentDisclosure = "store.guardian-consent-disclosure"
    const val ChildSafetyDisclosure = "store.child-safety-disclosure"
    const val BookingApproveAction = "booking.approve.action"
    const val ActiveRideScreen = "active-ride.screen"
    const val ActiveRideResumeAction = "active-ride.resume.action"
    const val ActiveRidePickupAction = "active-ride.pickup.action"
    const val ActiveRideDropoffAction = "active-ride.dropoff.action"
    const val ActiveRideEndAction = "active-ride.end.action"
    const val GoogleMapsRoutePreview = "active-ride.google-maps-route-preview"
    const val ActiveRideStaleWarning = "active-ride.stale-warning"
    const val EmergencyContact = "active-ride.emergency-contact"
    const val MessagesScreen = "messages.screen"
    const val ChatTab = "messages.chat.tab"
    const val RatingTab = "messages.rating.tab"
    const val RatingPromptAction = "messages.rating-prompt.action"
    const val ImpactScreen = "impact.screen"
    const val RewardsScreen = "rewards.screen"
    const val RewardsWithdrawAction = "rewards.withdraw.action"
    const val OptionsScreen = "options.screen"
    const val PrivacySummaryDisclosure = "store.privacy-summary-disclosure"
    const val SupportReportReasonInput = "options.support-report.reason"
    const val SupportReportDescriptionInput = "options.support-report.description"
    const val SupportReportAction = "options.support-report.action"
    const val PaymentsScreen = "payments.screen"
    const val PaymentAction = "payments.payment.action"
    const val PaymentConnectAction = "payments.connect.action"
    const val BottomNavHomeAction = "bottom-nav.home.action"
    const val BottomNavTripsAction = "bottom-nav.trips.action"
    const val BottomNavPublishAction = "bottom-nav.publish.action"
    const val BottomNavMessagesAction = "bottom-nav.messages.action"
    const val BottomNavProfileAction = "bottom-nav.profile.action"
}

fun Modifier.sgmTestTag(tag: String): Modifier = testTag(tag)

fun Modifier.sgmOptionalTestTag(tag: String?): Modifier =
    if (tag == null) this else testTag(tag)
