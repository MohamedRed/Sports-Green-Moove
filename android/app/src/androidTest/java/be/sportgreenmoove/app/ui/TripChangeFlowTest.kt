package be.sportgreenmoove.app.ui

import androidx.compose.runtime.*
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import androidx.test.filters.SdkSuppress
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.UnconfiguredFirebaseGateway
import be.sportgreenmoove.app.services.ReservationGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.IOException
import java.io.File

@SdkSuppress(minSdkVersion = 29)
class TripChangeFlowTest {
    @get:Rule val compose = createComposeRule()
    private val trip = UiFlowFixtures.trip.copy(driverUserId = "driver")
    private val terms = TripChangeTerms("2099-12-01T10:00:00Z", null, MapPoint(50.71, 4.61), MapPoint(50.85, 4.35), 250)
    private val revision = "a".repeat(64)
    private val proposal = "b".repeat(64)
    private fun review() = TripChangeReview(trip.id, proposal, revision, TripChangeStatus.Pending, terms,
        terms.copy(priceCents = 400), terms, 2, 0, null, listOf("own-booking"), true, false, false,
        emptyList(), "2026-10-17T12:00:00Z", revision, null, null, null)
    private inner class Gateway : FirebaseGateway by UnconfiguredFirebaseGateway() {
        var current = review()
        var proposals = 0
        var dropProposalAcknowledgement = false
        val decisions = mutableListOf<TripChangeDecisionRequest>()
        var applications = 0
        override suspend fun previewTripChange(tripId: String) = TripChangePreview(tripId, revision, terms, 3, 2)
        override suspend fun reviewTripChange(tripId: String, proposalId: String) = current
        override suspend fun proposeTripChange(request: TripChangeProposalRequest): TripChangeReview {
            proposals++
            current = current.copy(terms = request.terms, proposalRequestId = request.requestId, canRespond = false, canWithdraw = true)
            if (dropProposalAcknowledgement) throw IOException()
            return current
        }
        override suspend fun resolveTripChangeProposal(request: TripChangeProposalRequest): TripChangeReview? {
            assertEquals(current.proposalRequestId, request.requestId)
            assertEquals(current.terms, request.terms)
            return current
        }
        override suspend fun respondTripChange(request: TripChangeDecisionRequest): TripChangeReview {
            decisions += request
            current = current.copy(decision = request.decision, decisionRequestId = request.requestId, canRespond = false,
                acceptedParentCount = if (request.decision == TripChangeDecision.Accept) 1 else 0,
                status = if (request.decision == TripChangeDecision.Decline) TripChangeStatus.Declined else TripChangeStatus.Pending)
            return current
        }
        override suspend fun quoteTripChange(request: TripChangeQuoteRequest) =
            TripChangeRouteQuote("d".repeat(64), 12000, 900, null, "2099-12-01T10:00:00Z")
        override suspend fun applyTripChange(request: TripChangeApplyRequest): TripChangeApplicationReceipt {
            applications++
            current = current.copy(status = TripChangeStatus.Applied, applied = true, currentTerms = current.terms, canWithdraw = false,
                balances = listOf(TripChangeBalance("own-booking", 150)))
            return TripChangeApplicationReceipt(trip.id, proposal, revision, request.quoteId, request.requestId, "driver",
                "2026-10-17T12:00:00Z", listOf("own-booking"), 1)
        }
    }
    @Test fun owningDriverProposesChangedTermsWithoutStartingTheRide() {
        val gateway = Gateway(); var starts = 0
        compose.setSgmUiTestContent {
            TripsRoute("driver", AppRole.Driver, gateway, listOf(trip), null, 0, { starts++ }, {}, {}, {}, {})
        }
        compose.onNodeWithTag("trip.edit.${trip.id}").performScrollTo().performClick(); waitFor("trip.change.price")
        compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsNotEnabled()
        enterTripFormText(compose, "trip.change.price", "4,00")
        compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsEnabled().performClick(); waitFor("trip.change.status")
        compose.onNodeWithTag("trip.change.status").performScrollTo().assertTextEquals("Accords des parents en attente")
        capture("trip-change-driver-proposed.png")
        compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
        assertEquals(1, gateway.proposals); assertEquals(0, starts); assertEquals(terms, gateway.current.currentTerms)
    }
    @Test fun largeTextParentSeesBothVersionsAndAcceptsWithoutApplying() {
        val gateway = Gateway()
        host(gateway, AppRole.Parent, compact = true); waitFor("trip.change.status")
        compose.onNodeWithTag("trip.change.original").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("trip.change.proposed").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("trip.change.accept").performScrollTo().assertIsDisplayed()
        val bounds = compose.onNodeWithTag("trip.change.accept").fetchSemanticsNode().boundsInRoot
        val dialog = compose.onNode(isDialog()).fetchSemanticsNode().boundsInRoot
        assertTrue(bounds.left >= dialog.left && bounds.right <= dialog.right)
        capture("trip-change-parent-review-large-text.png")
        assertTrue(gateway.decisions.isEmpty())
        compose.onNodeWithTag("trip.change.accept").performClick(); waitFor("trip.change.decision")
        compose.onNodeWithTag("trip.change.decision").performScrollTo().assertTextEquals("Votre accord est enregistré.")
        compose.onNodeWithTag("trip.change.consents").assertTextEquals("Accords reçus : 1 / 2")
        capture("trip-change-parent-accepted.png")
        compose.onNodeWithTag("trip.change.accept").assertDoesNotExist(); compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
        assertEquals(1, gateway.decisions.size); assertFalse(gateway.current.applied)
    }
    @Test fun refreshRecoversAStoredProposalWithoutAnotherWriteWhenBothRepliesWereLost() {
        val gateway = Gateway().apply { dropProposalAcknowledgement = true }
        compose.setSgmUiTestContent {
            TripsRoute("driver", AppRole.Driver, gateway, listOf(trip), null, 0, {}, {}, {}, { throw IOException() }, {})
        }
        compose.onNodeWithTag("trip.edit.${trip.id}").performScrollTo().performClick(); waitFor("trip.change.price")
        enterTripFormText(compose, "trip.change.price", "4,00")
        compose.onNodeWithTag("trip.change.propose").performScrollTo().assertIsDisplayed().assertIsEnabled().performClick(); waitFor("trip.change.error")
        assertEquals(1, gateway.proposals)
        compose.onNodeWithTag("trip.change.propose").assertIsNotEnabled()
        compose.onNodeWithTag("trip.change.refresh").performScrollTo().performClick(); waitFor("trip.change.status")
        compose.onNodeWithTag("trip.change.status").performScrollTo().assertTextEquals("Accords des parents en attente")
        compose.onNodeWithTag("trip.change.propose").assertDoesNotExist(); assertEquals(1, gateway.proposals)
    }
    @Test fun refusalKeepsTheInitialTripWithoutCancellingTheBooking() {
        val gateway = Gateway(); host(gateway, AppRole.Parent); waitFor("trip.change.status")
        compose.onNodeWithTag("trip.change.decline").performScrollTo().performClick(); waitFor("trip.change.decision")
        compose.onNodeWithTag("trip.change.status").performScrollTo().assertTextEquals("Modification refusée, trajet initial conservé")
        capture("trip-change-parent-declined.png")
        assertEquals(terms, gateway.current.currentTerms); assertEquals(0, gateway.applications)
    }
    @Test fun parentOpensFromAffectedReservationAndKeepsTheRecordedRefusalVisible() {
        val gateway = Gateway()
        val item = UiFlowFixtures.reservation.copy(booking = UiFlowFixtures.bookingRequest.copy(tripId = trip.id),
            tripChangeId = proposal, allowedActions = emptySet())
        val reservations = object : ReservationGateway {
            override suspend fun list(role: AppRole, cursor: String?) = ReservationPage(listOf(
                item.copy(tripChangeId = proposal.takeIf { gateway.current.status == TripChangeStatus.Pending })), null)
            override suspend fun decide(bookingId: String, decision: ReservationDecision) = error("Unexpected booking mutation")
        }
        compose.setSgmUiTestContent {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                ReservationManagementRoute("parent", AppRole.Parent, reservations, gateway) {}
            }
        }
        waitFor("reservation.change.${item.booking.bookingId}")
        compose.onNodeWithTag("reservation.change.${item.booking.bookingId}").performScrollTo().performClick()
        waitFor("trip.change.status")
        compose.onNodeWithTag("trip.change.decline").performScrollTo().performClick(); waitFor("trip.change.decision")
        compose.onNodeWithTag("trip.change.decision").performScrollTo().assertTextEquals("Votre refus est enregistré.")
        compose.onNodeWithTag("reservation.change.${item.booking.bookingId}").assertDoesNotExist()
        assertEquals(1, gateway.decisions.size)
    }
    @Test fun agreementStillRequiresRouteAndApplicationAndDoesNotClaimSettlement() {
        val gateway = Gateway().apply { current = review().copy(status = TripChangeStatus.Confirmed, acceptedParentCount = 2,
            canRespond = false, canWithdraw = true) }
        host(gateway, AppRole.Driver); waitFor("trip.change.status")
        compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
        compose.onNodeWithTag("trip.change.calculate").performScrollTo().performClick(); waitFor("trip.change.apply")
        assertEquals(0, gateway.applications)
        compose.onNodeWithTag("trip.change.apply").performScrollTo().performClick(); waitFor("trip.change.applied")
        compose.onNodeWithTag("trip.change.balance.own-booking").performScrollTo().assertTextEquals("Supplément restant : 1,50 EUR")
        capture("trip-change-applied-balance-due.png")
        assertEquals(1, gateway.applications); compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
    }
    @Test fun provenApplicationNeverShowsTheStaleUnappliedMessageWhenRefreshFails() {
        val gateway = Gateway().apply { current = review().copy(status = TripChangeStatus.Confirmed, acceptedParentCount = 2,
            canRespond = false, canWithdraw = true) }
        host(gateway, AppRole.Driver, changed = { throw IOException() }); waitFor("trip.change.status")
        compose.onNodeWithTag("trip.change.calculate").performScrollTo().performClick(); waitFor("trip.change.apply")
        compose.onNodeWithTag("trip.change.apply").performScrollTo().performClick(); waitFor("trip.change.error")
        compose.onNodeWithTag("trip.change.status").performScrollTo().assertTextEquals("Nouveaux détails appliqués")
        compose.onNodeWithText("Les détails proposés ne sont pas encore appliqués.").assertDoesNotExist()
        compose.onNodeWithTag("trip.change.apply").assertDoesNotExist()
        assertEquals(1, gateway.applications)
    }
    private fun host(gateway: Gateway, role: AppRole, compact: Boolean = false, changed: suspend () -> Unit = {}) {
        compose.setSgmUiTestContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density * if (compact) 1.3f else 1f, if (compact) 1.5f else density.fontScale)) {
                TripChangeDialog(if (role == AppRole.Driver) "driver" else "parent", role, trip.id, trip.title, proposal, gateway, changed, {})
            }
        }
    }
    private fun waitFor(tag: String) = compose.waitUntil(10_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    private fun capture(name: String) {
        captureLocalUi(compose, name, dialog = true)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val device = UiDevice.getInstance(instrumentation)
        val windowName = name.removeSuffix(".png") + "-window.png"
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
        check(device.takeScreenshot(File(directory, windowName))) { "Native display capture failed." }
        device.executeShellCommand("mkdir -p /sdcard/Download/sgm-trip-changes")
        device.executeShellCommand("cp /sdcard/Android/data/${instrumentation.targetContext.packageName}/files/local-ui-evidence/$name /sdcard/Download/sgm-trip-changes/$name")
        device.executeShellCommand("cp /sdcard/Android/data/${instrumentation.targetContext.packageName}/files/local-ui-evidence/$windowName /sdcard/Download/sgm-trip-changes/$windowName")
    }
}
