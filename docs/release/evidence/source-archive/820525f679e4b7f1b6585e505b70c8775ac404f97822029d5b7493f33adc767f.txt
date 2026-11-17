package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

class ChildRideEmergencyFlowTest {
    @get:Rule val compose = createComposeRule()
    @Test fun childContactIsReadOnlyAndFitsANarrowLargeTextScreen() {
        val fixture = ChildEmergencyUiFixture(); host(fixture, narrow = true)
        val titles = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText("CONTACT D’URGENCE").performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(titles) }
        assertFalse("The complete emergency title must fit", titles.single().hasVisualOverflow)
        for (tag in listOf("emergency.name", "emergency.phone", "emergency.save", "emergency.remove", "emergency.children"))
            compose.onNodeWithTag(tag).assertDoesNotExist()
        for (tag in listOf("emergency.child-ride.phone", "emergency.child-ride.dial")) {
            val node = compose.onNodeWithTag(tag).performScrollTo().fetchSemanticsNode().boundsInRoot
            val bounds = compose.onNodeWithTag("child-emergency.narrow").fetchSemanticsNode().boundsInRoot
            assertTrue(node.left >= bounds.left && node.right <= bounds.right)
        }
        compose.onNodeWithTag("emergency.child-ride.phone").performScrollTo()
        capture("child-emergency-readonly-narrow.png"); assertEquals(0, fixture.opens)
    }
    @Test fun deniedFreshAuthorityClearsTheNumberBeforeAnyPhoneHandoff() {
        val fixture = ChildEmergencyUiFixture(); host(fixture)
        fixture.fail = true; click("emergency.child-ride.dial"); waitFor("emergency.child-ride.error")
        compose.onNodeWithTag("emergency.child-ride.phone").assertDoesNotExist()
        compose.onNodeWithTag("emergency.child-ride.dial").assertDoesNotExist()
        assertEquals(0, fixture.opens); capture("child-emergency-access-denied.png")
    }
    @Test fun changedContactNeedsAnotherTapAndAnUnavailablePhoneDoesNotSubstituteANumber() {
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        assertEquals(0, device.displayRotation); device.setOrientationLeft()
        try {
            val fixture = ChildEmergencyUiFixture(); host(fixture)
            fixture.current = fixture.current.copy(contact = PersonalEmergencyContact("Autre contact QA", "+12025550122"), revision = 2)
            click("emergency.child-ride.dial")
            compose.waitUntil(30_000) { compose.onAllNodesWithText("Le contact a changé. Vérifiez-le avant d’ouvrir le téléphone.").fetchSemanticsNodes().isNotEmpty() }
            assertEquals(0, fixture.opens); click("emergency.child-ride.dial"); waitFor("emergency.child-ride.error")
            assertEquals(1, fixture.opens)
            compose.onNodeWithTag("emergency.child-ride.phone").performScrollTo().assertTextEquals("+12025550122")
            capture("child-emergency-landscape-changed.png", landscape = true)
        } finally { device.setOrientationNatural(); device.unfreezeRotation() }
    }
    @Test fun absentContactHasNoPhoneDestinationOrEditingControl() {
        val fixture = ChildEmergencyUiFixture(); fixture.current = fixture.current.copy(contact = null, revision = 0)
        host(fixture, expected = "emergency.child-ride.empty")
        compose.onNodeWithTag("emergency.child-ride.dial").assertDoesNotExist()
        compose.onNodeWithTag("emergency.save").assertDoesNotExist(); assertEquals(0, fixture.opens)
    }
    @Test fun settingsEntryWithoutARideDoesNotReadOrManageTheChildContact() {
        val fixture = ChildEmergencyUiFixture()
        compose.setSgmUiTestContent { EmergencyContactRoute("child", setOf(AppRole.Child), fixture,
            UnconfiguredGuardianVerificationGateway(), {}, rideSessionId = null) }
        compose.onNodeWithText("Contact indisponible hors trajet.").assertIsDisplayed(); assertEquals(0, fixture.reads)
    }
    private fun host(fixture: ChildEmergencyUiFixture, narrow: Boolean = false, expected: String = "emergency.child-ride.phone") {
        compose.setSgmUiTestContent {
            val content: @androidx.compose.runtime.Composable () -> Unit = {
                EmergencyContactRoute("child", setOf(AppRole.Child, AppRole.Parent), fixture, UnconfiguredGuardianVerificationGateway(), {},
                    rideSessionId = "ride", launchDialer = { fixture.opens++; EmergencyDialerResult.Unavailable })
            }
            if (narrow) {
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
                    Box(Modifier.width(320.dp).testTag("child-emergency.narrow")) { content() }
                }
            } else content()
        }
        waitFor(expected)
    }
    private fun click(tag: String) { waitFor(tag); compose.onNodeWithTag(tag).performScrollTo().assertIsEnabled().performClick() }
    private fun waitFor(tag: String) { compose.waitUntil(30_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() } }
    private fun capture(name: String, landscape: Boolean = false) {
        captureLocalUi(compose, name, landscape = landscape)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val device = UiDevice.getInstance(instrumentation)
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
        val window = name.removeSuffix(".png") + "-window.png"; check(device.takeScreenshot(File(directory, window)))
        device.executeShellCommand("mkdir -p /sdcard/Download/sgm-child-emergency-components")
        for (file in listOf(name, window)) device.executeShellCommand(
            "cp /sdcard/Android/data/${instrumentation.targetContext.packageName}/files/local-ui-evidence/$file /sdcard/Download/sgm-child-emergency-components/$file")
    }
}
private class ChildEmergencyUiFixture : EmergencyContactGateway {
    override suspend fun discoverChildRideEmergencyContact(uid: String): ChildRideEmergencyContactView? = readChildRideEmergencyContact(uid, current.rideSessionId)
    var current = ChildRideEmergencyContactView("child", "ride", "profile-child", "a".repeat(64), "Enfant fictif QA",
        PersonalEmergencyContact("Alexandre de la Croix Saint-Lambert QA", "+12025550121"), 1)
    var reads = 0; var opens = 0; var fail = false
    override suspend fun readChildRideEmergencyContact(uid: String, rideSessionId: String): ChildRideEmergencyContactView {
        reads++; check(uid == "child" && rideSessionId == "ride"); if (fail) error("Explicit revoked-parent fixture"); return current
    }
    override suspend fun readEmergencyContact(uid: String, target: EmergencyContactTarget): EmergencyContactView = error("No adult contact read")
    override suspend fun saveEmergencyContact(uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt = error("No child edit capability")
}
