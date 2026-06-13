package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.design.SgmTheme
import org.junit.Rule
import org.junit.Test

class SportsGreenMooveUiFlowTest {
    @get:Rule
    val compose = createComposeRule()

    private val firebase = UiFlowFirebaseGateway()

    @Test
    fun authFlowExposesNativeUiActions() {
        setTestContent {
            OnboardingScreen(
                loading = false,
                error = null,
                onSubmit = { _, _, _, _ -> },
                onGoogle = {},
                onFacebook = {},
            )
        }

        assertTagsExist(
            SgmTestTags.AuthScreen,
            SgmTestTags.AuthEmailAction,
            SgmTestTags.AuthFacebookAction,
            SgmTestTags.AuthGoogleAction,
        )
    }

    @Test
    fun publishingSearchAndBookingFlowsExposeNativeUiActions() {
        setTestContent {
            PublishScreen(
                role = AppRole.Driver,
                firebase = firebase,
                onError = {},
                onNotice = {},
                onPublished = {},
            )
        }
        assertTagsExist(SgmTestTags.PublishScreen, SgmTestTags.PublishNextAction)

        setTestContent {
            SearchScreen(
                origin = UiFlowFixtures.origin,
                destination = UiFlowFixtures.destination,
                originSuggestions = emptyList(),
                destinationSuggestions = emptyList(),
                children = listOf(UiFlowFixtures.child),
                matches = listOf(UiFlowFixtures.match),
                loading = false,
                error = null,
                onBack = {},
                onSuggestOrigin = {},
                onSuggestDestination = {},
                onSelectOrigin = {},
                onSelectDestination = {},
                onSearch = {},
                onRequest = { _, _ -> },
            )
        }
        assertTagsExist(SgmTestTags.SearchScreen, SgmTestTags.SearchAction, SgmTestTags.BookingRequestAction)

        setTestContent {
            BookingRequestsList(
                requests = listOf(UiFlowFixtures.bookingRequest),
                onApprove = {},
            )
        }
        assertTagsExist(SgmTestTags.BookingApproveAction)
    }

    @Test
    fun activeRideSafetyFlowExposesNativeUiActions() {
        setTestContent {
            RideMonitorScreen(
                activeRide = UiFlowFixtures.activeRide,
                routePreview = UiFlowFixtures.route,
                onBack = {},
                onPickup = {},
                onDropoff = {},
                onEndRide = {},
            )
        }

        assertTagsExist(
            SgmTestTags.ActiveRideScreen,
            SgmTestTags.ActiveRidePickupAction,
            SgmTestTags.ActiveRideDropoffAction,
            SgmTestTags.ActiveRideEndAction,
            SgmTestTags.EmergencyContact,
        )
    }

    @Test
    fun secondaryPlanFlowsExposeNativeUiActions() {
        setTestContent { GroupsScreen(onBack = {}) }
        assertTagsExist(SgmTestTags.GroupsScreen, SgmTestTags.GroupsJoinAction)

        setTestContent { ImpactScreen(onBack = {}) }
        assertTagsExist(SgmTestTags.ImpactScreen)

        setTestContent { RewardsScreen(onBack = {}) }
        assertTagsExist(SgmTestTags.RewardsScreen, SgmTestTags.RewardsWithdrawAction)

        setTestContent { OptionsScreen(firebase = firebase, onBack = {}) }
        assertTagsExist(SgmTestTags.OptionsScreen, SgmTestTags.SupportReportAction)

        setTestContent {
            PaymentsScreen(
                role = AppRole.Parent,
                bookings = listOf(UiFlowFixtures.payableBooking),
                loading = false,
                onBack = {},
                onPay = {},
                onStartConnect = {},
            )
        }
        assertTagsExist(SgmTestTags.PaymentsScreen, SgmTestTags.PaymentAction)
    }

    @Test
    fun messagesChatAndRatingFlowsExposeNativeUiActions() {
        setTestContent { MessagesScreen(firebase = firebase) }

        assertTagsExist(SgmTestTags.MessagesScreen, SgmTestTags.ChatTab, SgmTestTags.RatingTab)
        compose.onNodeWithTag(SgmTestTags.RatingTab).performClick()
        assertTagsExist(SgmTestTags.RatingPromptAction, "${SgmTestTags.RatingPromptAction}.5")
    }

    private fun assertTagsExist(vararg tags: String) {
        tags.forEach { tag ->
            compose.onNodeWithTag(tag).assertExists()
        }
    }

    private fun setTestContent(content: @Composable () -> Unit) {
        compose.setContent {
            SgmTheme(darkTheme = false) {
                V2ThemeToggleProvider(darkTheme = false, onToggle = {}) {
                    content()
                }
            }
        }
    }
}
