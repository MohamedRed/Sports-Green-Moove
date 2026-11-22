package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.GuardianVerificationGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class GuardianVerificationFlowTest {
    @get:Rule val compose = createComposeRule()

    @Test fun cancelledConfirmationDoesNotSendAndRequestAloneNeverVerifiesAParent() {
        val fixture = GuardianUiFixture(); host(fixture); selectPair()
        click("guardian.action.request"); click("guardian.keep"); assertEquals(0, fixture.writes)
        click("guardian.action.request"); click("guardian.confirm")
        compose.onNodeWithTag("guardian.status").performScrollTo().assertTextEquals("En attente")
        assertEquals(1, fixture.writes); compose.onNodeWithText("Parent vérifié").assertDoesNotExist()
    }
    @Test fun aLostReplyRequiresAnExplicitReadAndDoesNotSendAgain() {
        val fixture = GuardianUiFixture().apply { loseReply = true }; host(fixture); selectPair()
        click("guardian.action.request"); click("guardian.confirm")
        compose.onNodeWithTag("guardian.error").performScrollTo().assertTextContains("non confirmée", substring = true)
        compose.onNodeWithTag("guardian.current").assertDoesNotExist(); assertEquals(1, fixture.writes)
        click(SgmTestTags.GroupsRefreshAction)
        compose.onNodeWithTag("guardian.status").performScrollTo().assertTextEquals("En attente"); assertEquals(1, fixture.writes)
    }
    @Test fun aVerifiedRelationshipCanBeWithdrawnAndThenRequestedAgain() {
        val fixture = GuardianUiFixture().apply { record = record.copy(status = GuardianVerificationStatus.Verified, revision = 4,
            allowedActions = listOf(GuardianParentAction.Withdraw)) }
        host(fixture); selectPair()
        compose.onNodeWithTag("guardian.status").performScrollTo().assertTextEquals("Parent vérifié")
        compose.onNodeWithTag("guardian.action.request").assertDoesNotExist()
        click("guardian.action.withdraw"); click("guardian.confirm")
        compose.onNodeWithTag("guardian.status").performScrollTo().assertTextEquals("Demande retirée")
        compose.onNodeWithTag("guardian.action.request").performScrollTo().assertIsEnabled()
        assertEquals(5L, fixture.record.revision)
    }
    @Test fun longNamesAndConfirmationControlsFitANarrowScreenWithLargeText() {
        val fixture = GuardianUiFixture().apply { record = record.copy(childName = "Alexandre de la Croix Saint-Lambert QA",
            clubName = "Association sportive des jeunes de Louvain-la-Neuve QA") }
        host(fixture, narrow = true); selectPair()
        for (tag in listOf("guardian.child", "guardian.club", "guardian.review", "guardian.action.request")) {
            val box = compose.onNodeWithTag(tag).performScrollTo().fetchSemanticsNode().boundsInRoot
            val host = compose.onNodeWithTag("guardian.narrow").fetchSemanticsNode().boundsInRoot
            assertTrue("$tag must fit", box.left >= host.left && box.right <= host.right)
        }
        click("guardian.action.request"); compose.onNodeWithTag("guardian.confirm").assertIsDisplayed()
        compose.onNodeWithTag("guardian.keep").assertIsDisplayed()
    }
    private fun host(fixture: GuardianUiFixture, narrow: Boolean = false) {
        compose.setSgmUiTestContent {
            if (narrow) {
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
                    Box(Modifier.width(320.dp).testTag("guardian.narrow")) { GuardianVerificationRoute("parent", fixture, {}) }
                }
            } else GuardianVerificationRoute("parent", fixture, {})
        }
    }
    private fun selectPair() {
        click("guardian.child"); click("guardian.option.child")
        click("guardian.club"); click("guardian.option.club"); click("guardian.review")
    }
    private fun click(tag: String) {
        val node = compose.onNodeWithTag(tag)
        if (tag !in setOf("guardian.confirm", "guardian.keep")) node.performScrollTo()
        node.assertIsEnabled().performClick()
    }
}

private class GuardianUiFixture : GuardianVerificationGateway {
    var record = GuardianVerification("a".repeat(64), "club", "child", "parent", "Club QA", "Enfant QA", null, 0,
        listOf(GuardianParentAction.Request))
    var writes = 0
    var loseReply = false
    override suspend fun guardianOptions(uid: String, kind: GuardianOptionKind, cursor: String?) = GuardianPage(
        listOf(if (kind == GuardianOptionKind.Children) GuardianOption("child", record.childName) else GuardianOption("club", record.clubName)), null)
    override suspend fun guardianHistory(uid: String, cursor: String?) = GuardianPage(if (record.status == null) emptyList() else listOf(record), null)
    override suspend fun guardianView(uid: String, clubId: String, childId: String) = record
    override suspend fun transitionGuardian(request: GuardianParentOperation): GuardianTransitionReceipt {
        check(request.expectedRevision == record.revision); writes++
        record = record.copy(status = if (request.action == GuardianParentAction.Request) GuardianVerificationStatus.Requested else GuardianVerificationStatus.Withdrawn,
            revision = record.revision + 1, allowedActions = listOf(if (request.action == GuardianParentAction.Request) GuardianParentAction.Withdraw else GuardianParentAction.Request))
        if (loseReply) error("Lost reply")
        return GuardianTransitionReceipt(record.id, requireNotNull(record.status), record.revision)
    }
}
