package be.sportgreenmoove.app.ui

import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import be.sportgreenmoove.app.data.AppRole
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
                error = "Entrez votre adresse e-mail.",
                onSubmit = { _, _, _, _ -> },
                onGoogle = {},
                onFacebook = {},
            )
        }

        assertTagsExist(
            SgmTestTags.AuthScreen,
            SgmTestTags.AuthEmailAction,
            SgmTestTags.AuthError,
            SgmTestTags.AuthFacebookAction,
            SgmTestTags.AuthGoogleAction,
        )
        compose.onNodeWithTag(SgmTestTags.AuthEmailAction).assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.AuthError).assertIsDisplayed()
        compose.onNodeWithTag(SgmTestTags.AuthGoogleAction).assertIsDisplayed()
    }

    @Test
    fun publishingSearchAndBookingFlowsExposeNativeUiActions() {
        val host = setSwitchableTestContent {
            PublishScreen(
                role = AppRole.Driver,
                firebase = firebase,
                initialOrigin = UiFlowFixtures.origin,
                initialDestination = UiFlowFixtures.destination,
                onError = {},
                onNotice = {},
                onPublished = {},
            )
        }
        assertTagsExist(SgmTestTags.PublishScreen, SgmTestTags.PublishNextAction)
        compose.onNodeWithTag(SgmTestTags.PublishNextAction).performClick()
        compose.onNodeWithTag(SgmTestTags.PublishNextAction).performClick()
        assertTagsExist(SgmTestTags.PublishSubmitAction)

        host.show {
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

        host.show {
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
    fun activeRidePermissionGateShowsBackgroundLocationDisclosureBeforeOsPrompt() {
        setTestContent {
            val gate = rememberActiveRidePermissionGate(onBlocked = {})
            Button(onClick = { gate.runWhenReady {} }) {
                Text("Démarrer le suivi")
            }
        }

        compose.onNodeWithText("Démarrer le suivi").performClick()
        compose.onNodeWithText("Suivi de course").assertIsDisplayed()
        compose.onNodeWithText("position précise en arrière-plan", substring = true).assertIsDisplayed()
        compose.onNodeWithText("Continuer").assertIsDisplayed()
        compose.onNodeWithText("Annuler").assertIsDisplayed()
    }

    @Test
    fun secondaryPlanFlowsExposeNativeUiActions() {
        val host = setSwitchableTestContent { GroupsScreen(clubs = UiFlowFixtures.clubs, onBack = {}) }
        assertTagsExist(SgmTestTags.GroupsScreen, SgmTestTags.GroupsJoinAction)

        host.show { ImpactScreen(summary = UiFlowFixtures.impact, onBack = {}) }
        assertTagsExist(SgmTestTags.ImpactScreen)

        host.show { RewardsScreen(summary = UiFlowFixtures.rewards, onBack = {}) }
        assertTagsExist(SgmTestTags.RewardsScreen, SgmTestTags.RewardsWithdrawAction)

        host.show { OptionsScreen(firebase = firebase, onBack = {}) }
        assertTagsExist(SgmTestTags.OptionsScreen, SgmTestTags.SupportReportAction)

        host.show {
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

    @Test
    fun bottomNavigationDispatchesTopLevelUserFlowDestinations() {
        val navigated = mutableListOf<AppScreen>()

        setTestContent {
            SportsGreenMooveScaffold(
                currentScreen = AppScreen.Home,
                onNavigate = { navigated += it },
            ) {
                Text("Navigation fixture")
            }
        }

        compose.onNodeWithTag(SgmTestTags.BottomNavTripsAction).performClick()
        compose.onNodeWithTag(SgmTestTags.BottomNavPublishAction).performClick()
        compose.onNodeWithTag(SgmTestTags.BottomNavMessagesAction).performClick()
        compose.onNodeWithTag(SgmTestTags.BottomNavProfileAction).performClick()
        compose.onNodeWithTag(SgmTestTags.BottomNavHomeAction).performClick()

        assertEquals(
            listOf(AppScreen.Trips, AppScreen.Publish, AppScreen.Messages, AppScreen.Profile, AppScreen.Home),
            navigated,
        )
    }

    @Test
    fun profileRoleSelectorOnlyShowsGrantedRoles() {
        setTestContent {
            ProfileRoleSelector(
                role = AppRole.Parent,
                availableRoles = setOf(AppRole.Parent),
                onRoleChange = {},
            )
        }

        compose.onNodeWithText("Parent").assertIsDisplayed()
        assertTrue(compose.onAllNodesWithText("Conducteur").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Enfant").fetchSemanticsNodes().isEmpty())
        assertTrue(compose.onAllNodesWithText("Club manager").fetchSemanticsNodes().isEmpty())
    }

    private fun assertTagsExist(vararg tags: String) {
        tags.forEach { tag ->
            compose.onNodeWithTag(tag).assertExists()
        }
    }

    private fun setTestContent(content: @Composable () -> Unit) {
        compose.setSgmUiTestContent(content)
    }

    private fun setSwitchableTestContent(content: @Composable () -> Unit): TestContentHost {
        val activeContent = mutableStateOf<@Composable () -> Unit>(content)
        compose.setSgmUiTestContent {
            activeContent.value()
        }
        return TestContentHost(activeContent)
    }

    private inner class TestContentHost(
        private val activeContent: MutableState<@Composable () -> Unit>,
    ) {
        fun show(content: @Composable () -> Unit) {
            compose.runOnIdle {
                activeContent.value = content
            }
            compose.waitForIdle()
        }
    }
}
