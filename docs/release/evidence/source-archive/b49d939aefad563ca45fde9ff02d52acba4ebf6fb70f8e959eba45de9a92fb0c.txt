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
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

class EmergencyContactFlowTest {
    @get:Rule val compose = createComposeRule()
    @Test fun aLateInitialReadKeepsTheChildPickerOpenUntilTheSelectionCanBeAccepted() {
        val fixture = EmergencyUiFixture().apply { historyGate = CompletableDeferred(); firstReadGate = CompletableDeferred() }
        compose.setSgmUiTestContent { content(fixture) }
        click("emergency.children")
        compose.onNodeWithText("Choisir un enfant").assertIsDisplayed()
        compose.runOnIdle { fixture.historyGate!!.complete(Unit) }
        val child = "emergency.child.${fixture.verification.id}"
        waitFor(hasTestTag(child)); waitFor(hasTestTag("emergency.loading"))
        compose.onNodeWithTag(child).assertIsNotEnabled()
        compose.onNodeWithText("Choisir un enfant").assertIsDisplayed()
        compose.runOnIdle { fixture.firstReadGate!!.complete(Unit) }
        click(child)
        waitFor(hasTestTag("emergency.subject") and hasText("Enfant fictif QA"))
        compose.onNodeWithText("Choisir un enfant").assertDoesNotExist()
        compose.onNodeWithTag("emergency.empty").assertExists(); assertEquals(0, fixture.writes)
    }
    @Test fun saveReloadAndCancelledRemovalKeepTheConfirmedContact() {
        val fixture = EmergencyUiFixture(); host(fixture)
        edit("Contact fictif QA", "+12025550123"); click("emergency.save")
        waitFor(hasTestTag("emergency.dial") and isEnabled()); assertEquals(1, fixture.writes)
        click("emergency.remove"); click("emergency.keep")
        assertEquals(1, fixture.writes); compose.onNodeWithTag("emergency.phone").assertTextContains("+12025550123")
        click("emergency.remove"); click("emergency.confirm"); waitFor(hasTestTag("emergency.empty"))
        assertEquals(2, fixture.writes); assertEquals(2L, fixture.current.revision)
        compose.onNodeWithTag("emergency.dial").assertDoesNotExist()
    }
    @Test fun anInvalidLocalNumberNeverGetsSavedOrReplacedByAnotherDestination() {
        val fixture = EmergencyUiFixture(); host(fixture); edit("Contact fictif QA", "112")
        compose.onNodeWithTag("emergency.save").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag("emergency.dial").assertDoesNotExist(); assertEquals(0, fixture.writes)
        compose.onNodeWithTag("emergency.phone").assertTextContains("112")
    }
    @Test fun lostReplyClearsTheFormAndExplicitRefreshDoesNotSubmitAgain() {
        val fixture = EmergencyUiFixture().apply { loseReply = true }; host(fixture)
        edit("Contact fictif QA", "+12025550123"); click("emergency.save"); waitFor(hasTestTag("emergency.error"))
        compose.onNodeWithTag("emergency.phone").assertDoesNotExist(); assertEquals(1, fixture.writes)
        click("emergency.refresh"); waitFor(hasTestTag("emergency.dial") and isEnabled())
        compose.onNodeWithTag("emergency.phone").performScrollTo().assertTextContains("+12025550123")
        assertEquals(1, fixture.writes)
    }
    @Test fun deniedFreshChildAuthorityRemovesThePreviouslyShownNumber() {
        val fixture = EmergencyUiFixture().apply { current = current.copy(contact = contact, revision = 1) }; host(fixture)
        click("emergency.children"); click("emergency.child.${fixture.verification.id}")
        waitFor(hasText("Enfant fictif QA", substring = false))
        compose.onNodeWithTag("emergency.phone").performScrollTo().assertTextContains("+12025550123")
        fixture.failRead = true; click("emergency.refresh"); waitFor(hasTestTag("emergency.error"))
        compose.onNodeWithTag("emergency.phone").assertDoesNotExist(); compose.onNodeWithTag("emergency.dial").assertDoesNotExist()
        assertEquals(0, fixture.writes)
    }
    @Test fun aChangedNumberNeedsAnotherTapAndAnUnavailableDialerKeepsThatNumberVisible() {
        val fixture = EmergencyUiFixture().apply { current = current.copy(contact = contact, revision = 1) }; host(fixture)
        fixture.current = fixture.current.copy(contact = fixture.contact.copy(phone = "+12025550124"), revision = 2)
        click("emergency.dial"); waitFor(hasTestTag("emergency.notice")); assertEquals(0, fixture.opens)
        compose.onNodeWithTag("emergency.phone").performScrollTo().assertTextContains("+12025550124")
        click("emergency.dial"); waitFor(hasTestTag("emergency.error")); assertEquals(1, fixture.opens)
        compose.onNodeWithText("Aucune application téléphone disponible.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("emergency.phone").performScrollTo().assertTextContains("+12025550124")
        capture("emergency-editor-changed.png")
    }
    @Test fun fieldsActionsAndRemovalConfirmationFitANarrowScreenWithLargeText() {
        val fixture = EmergencyUiFixture().apply { current = current.copy(contact = contact.copy(name = "Alexandre de la Croix Saint-Lambert QA"), revision = 1) }
        host(fixture, narrow = true)
        val titles = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText("CONTACT D’URGENCE").performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(titles) }
        assertFalse("The complete emergency title must fit", titles.single().hasVisualOverflow)
        waitFor(hasTestTag("emergency.phone"))
        for (tag in listOf("emergency.name", "emergency.phone", "emergency.save", "emergency.dial", "emergency.remove")) {
            val bounds = compose.onNodeWithTag(tag).performScrollTo().fetchSemanticsNode().boundsInRoot
            val host = compose.onNodeWithTag("emergency.narrow").fetchSemanticsNode().boundsInRoot
            assertTrue("$tag must fit", bounds.left >= host.left && bounds.right <= host.right)
        }
        compose.onNodeWithTag("emergency.name").performScrollTo(); capture("emergency-editor-narrow.png")
        click("emergency.remove"); compose.onNodeWithTag("emergency.confirm").assertIsDisplayed()
        compose.onNodeWithTag("emergency.keep").assertIsDisplayed(); assertEquals(0, fixture.writes)
    }
    private fun host(fixture: EmergencyUiFixture, narrow: Boolean = false) {
        compose.setSgmUiTestContent {
            if (narrow) {
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
                    Box(Modifier.width(320.dp).testTag("emergency.narrow")) { content(fixture) }
                }
            } else content(fixture)
        }
        waitFor(hasTestTag("emergency.name"))
    }
    @androidx.compose.runtime.Composable private fun content(fixture: EmergencyUiFixture) {
        EmergencyContactRoute("parent", setOf(AppRole.Parent), fixture, fixture, {}, launchDialer = {
            fixture.opens++; EmergencyDialerResult.Unavailable
        })
    }
    private fun edit(name: String, phone: String) {
        compose.onNodeWithTag("emergency.name").performScrollTo().performTextReplacement(name)
        compose.onNodeWithTag("emergency.phone").performScrollTo().performTextReplacement(phone)
    }
    private fun click(tag: String) {
        waitFor(hasTestTag(tag) and isEnabled()); val node = compose.onNodeWithTag(tag)
        if (tag !in setOf("emergency.confirm", "emergency.keep")) node.performScrollTo()
        node.assertIsEnabled().performClick()
    }
    private fun waitFor(matcher: SemanticsMatcher) { compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() } }
    private fun capture(name: String) {
        captureLocalUi(compose, name)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val device = UiDevice.getInstance(instrumentation)
        val directory = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
        val window = name.removeSuffix(".png") + "-window.png"; check(device.takeScreenshot(File(directory, window)))
        device.executeShellCommand("mkdir -p /sdcard/Download/sgm-emergency-contact")
        for (file in listOf(name, window)) device.executeShellCommand(
            "cp /sdcard/Android/data/${instrumentation.targetContext.packageName}/files/local-ui-evidence/$file /sdcard/Download/sgm-emergency-contact/$file")
    }
}

private class EmergencyUiFixture : EmergencyContactGateway, GuardianVerificationGateway by UnconfiguredGuardianVerificationGateway() {
    override suspend fun readChildRideEmergencyContact(uid: String, rideSessionId: String): ChildRideEmergencyContactView =
        error("This fixture does not implement child ride reads")
    val contact = PersonalEmergencyContact("Contact fictif QA", "+12025550123")
    var current = EmergencyContactView("parent", EmergencyContactTarget.Self, null, 0)
    val verification = GuardianVerification("e".repeat(64), "club", "child", "parent", "Club fictif QA", "Enfant fictif QA",
        GuardianVerificationStatus.Verified, 2, listOf(GuardianParentAction.Withdraw))
    var writes = 0; var opens = 0; var loseReply = false; var failRead = false
    var historyGate: CompletableDeferred<Unit>? = null
    var firstReadGate: CompletableDeferred<Unit>? = null
    private var reads = 0
    override suspend fun guardianHistory(uid: String, cursor: String?): GuardianPage<GuardianVerification> {
        historyGate?.await(); return GuardianPage(listOf(verification), null)
    }
    override suspend fun readEmergencyContact(uid: String, target: EmergencyContactTarget): EmergencyContactView {
        if (reads++ == 0) firstReadGate?.await()
        if (failRead) error("Explicit denied-read fixture")
        return current.copy(target = target, childName = if (target is EmergencyContactTarget.Child) verification.childName else null,
            clubName = if (target is EmergencyContactTarget.Child) verification.clubName else null,
            childInstanceId = if (target is EmergencyContactTarget.Child) "d".repeat(64) else null)
    }
    override suspend fun saveEmergencyContact(uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt {
        check(operation.expectedRevision == current.revision); writes++
        current = current.copy(target = operation.target, contact = operation.contact, revision = current.revision + 1)
        if (loseReply) error("Explicit lost-reply fixture")
        return EmergencyContactReceipt(current.revision)
    }
}
