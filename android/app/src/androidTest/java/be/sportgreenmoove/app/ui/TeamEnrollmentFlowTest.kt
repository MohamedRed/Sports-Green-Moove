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
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.TeamEnrollmentGateway
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class TeamEnrollmentFlowTest {
    @get:Rule val compose = createComposeRule()
    @Test fun aReviewedRequestNeedsConfirmationAndNeverApprovesItself() {
        val fixture = TeamEnrollmentUiFixture(); host(fixture); selectTeam(); click("team-enrollment.review")
        waitFor(hasTestTag("team-enrollment.action.request")); click("team-enrollment.action.request"); click("team-enrollment.keep")
        assertEquals(0, fixture.writes.size)
        click("team-enrollment.action.request"); click("team-enrollment.confirm")
        waitFor(hasText("En attente", substring = false)); assertEquals(1, fixture.writes.size)
        assertNotEquals(TeamEnrollmentStatus.Approved, fixture.current.status)
        compose.onNodeWithTag("team-enrollment.action.request").assertDoesNotExist(); capture("team-requested.png")
    }
    @Test fun theParentSelectsAVerifiedChildWithoutChangingTheTeamOrAnotherSubject() {
        val fixture = TeamEnrollmentUiFixture(); host(fixture); selectTeam()
        click("team-enrollment.subject.true"); click("team-enrollment.child"); click("team-enrollment.option.child")
        click("team-enrollment.review"); waitFor(hasTestTag("team-enrollment.action.request"))
        click("team-enrollment.action.request"); compose.onNodeWithTag("team-enrollment.confirm").assertIsDisplayed()
        click("team-enrollment.confirm"); waitFor(hasText("En attente", substring = false))
        assertEquals("child", fixture.writes.single().childId)
        assertEquals("team", fixture.writes.single().teamId)
    }
    @Test fun anUncertainReplyHasNoActionUntilTheUserReadsAgain() {
        val fixture = TeamEnrollmentUiFixture().apply { loseReply = true }; host(fixture); selectTeam(); click("team-enrollment.review")
        click("team-enrollment.action.request"); click("team-enrollment.confirm"); waitFor(hasTestTag("team-enrollment.error"))
        compose.onNodeWithTag("team-enrollment.action.request").assertDoesNotExist(); assertEquals(1, fixture.writes.size)
        click("team-enrollment.review"); waitFor(hasText("En attente", substring = false)); assertEquals(1, fixture.writes.size)
    }
    @Test fun approvedWithdrawalIsConfirmedAndNarrowLargeTextRemainsWithinItsScreen() {
        val fixture = TeamEnrollmentUiFixture().apply { current = current.copy(status = TeamEnrollmentStatus.Approved, revision = 4,
            teamName = "Equipe des jeunes de la Croix Saint-Lambert QA", allowedActions = listOf(TeamEnrollmentAction.Withdraw)) }
        host(fixture, narrow = true); selectTeam(); click("team-enrollment.review"); waitFor(hasTestTag("team-enrollment.action.withdraw"))
        for (tag in listOf("team-enrollment.club", "team-enrollment.team", "team-enrollment.subject.true", "team-enrollment.review", "team-enrollment.action.withdraw")) {
            val bounds = compose.onNodeWithTag(tag).performScrollTo().fetchSemanticsNode().boundsInRoot
            val host = compose.onNodeWithTag("team-enrollment.narrow").fetchSemanticsNode().boundsInRoot
            assertTrue("$tag must fit", bounds.left >= host.left && bounds.right <= host.right)
        }
        capture("team-approved-narrow.png")
        click("team-enrollment.action.withdraw"); compose.onNodeWithTag("team-enrollment.confirm").assertIsDisplayed()
        compose.onNodeWithTag("team-enrollment.keep").assertIsDisplayed(); click("team-enrollment.keep"); assertEquals(0, fixture.writes.size)
        click("team-enrollment.action.withdraw"); click("team-enrollment.confirm"); waitFor(hasText("Inscription retirée", substring = false))
        assertEquals(1, fixture.writes.size); assertEquals(5L, fixture.current.revision)
    }
    private fun host(fixture: TeamEnrollmentUiFixture, narrow: Boolean = false) {
        compose.setSgmUiTestContent {
            if (narrow) {
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
                    Box(Modifier.width(320.dp).testTag("team-enrollment.narrow")) { TeamEnrollmentRoute("parent", fixture, true, {}) }
                }
            } else TeamEnrollmentRoute("parent", fixture, true, {})
        }
        waitFor(hasTestTag("team-enrollment.club") and isEnabled())
    }
    private fun selectTeam() {
        click("team-enrollment.club"); click("team-enrollment.option.club")
        click("team-enrollment.team"); click("team-enrollment.option.team")
    }
    private fun click(tag: String) {
        waitFor(hasTestTag(tag) and isEnabled()); val node = compose.onNodeWithTag(tag)
        if (tag !in setOf("team-enrollment.confirm", "team-enrollment.keep") && !tag.startsWith("team-enrollment.option.")) node.performScrollTo()
        node.assertIsEnabled().performClick()
    }
    private fun waitFor(matcher: SemanticsMatcher) { compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() } }
    private fun capture(name: String) {
        captureLocalUi(compose, name)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val device = UiDevice.getInstance(instrumentation)
        val source = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
        val window = name.removeSuffix(".png") + "-window.png"; check(device.takeScreenshot(File(source, window)))
        for (file in listOf(name, window)) {
            val original = File(source, file)
            val target = "/sdcard/Download/sgm-team-enrollment/$file"
            check(original.isFile && original.length() > 0)
            check(Regex("[A-Za-z0-9/_.-]+").matches(original.absolutePath))
            check(device.executeShellCommand("mkdir -p /sdcard/Download/sgm-team-enrollment").isBlank())
            // UiAutomation executes argv directly; shell quotes would become literal path characters.
            check(device.executeShellCommand("cp ${original.absolutePath} $target").isBlank())
            val expected = MessageDigest.getInstance("SHA-256").digest(original.readBytes()).joinToString("") { "%02x".format(it) }
            val observed = device.executeShellCommand("sha256sum $target").trim().split(Regex("\\s+"))
            check(observed.size == 2 && observed[0] == expected && observed[1] == target) { "Team capture export was not verified: $file" }
        }
    }
}

internal class TeamEnrollmentUiFixture : TeamEnrollmentGateway {
    override suspend fun ownedTeamEnrollments(uid: String, cursor: String?): GuardianPage<TeamEnrollmentView> = error("History is not part of this request fixture")
    override suspend fun ownedTeamEnrollmentView(uid: String, enrollmentId: String): TeamEnrollmentView = error("History is not part of this request fixture")
    override suspend fun withdrawOwnedTeamEnrollment(uid: String, expected: TeamEnrollmentView, requestId: String): TeamEnrollmentReceipt = error("History is not part of this request fixture")
    var current = TeamEnrollmentView("a".repeat(64), "team", "club", "b".repeat(64), "Equipe fictive QA", "parent", null,
        "Parent fictif QA", null, 0, true, listOf(TeamEnrollmentAction.Request))
    val writes = mutableListOf<TeamEnrollmentView>(); var loseReply = false
    override suspend fun teamOptions(uid: String, kind: TeamEnrollmentOptionKind, contextId: String?, cursor: String?) = GuardianPage(
        listOf(when (kind) { TeamEnrollmentOptionKind.Clubs -> GuardianOption("club", "Club fictif QA")
            TeamEnrollmentOptionKind.Teams -> GuardianOption("team", "Equipe fictive QA"); TeamEnrollmentOptionKind.Children -> GuardianOption("child", "Enfant fictif QA") }), null)
    override suspend fun teamEnrollmentView(uid: String, teamId: String, childId: String?) = current.copy(childId = childId,
        subjectId = childId ?: uid, subjectName = if (childId == null) "Parent fictif QA" else "Enfant fictif QA")
    override suspend fun changeTeamEnrollment(uid: String, expected: TeamEnrollmentView, action: TeamEnrollmentAction, requestId: String): TeamEnrollmentReceipt {
        writes += expected
        current = expected.copy(status = if (action == TeamEnrollmentAction.Request) TeamEnrollmentStatus.Requested else TeamEnrollmentStatus.Withdrawn,
            revision = expected.revision + 1, allowedActions = listOf(if (action == TeamEnrollmentAction.Request) TeamEnrollmentAction.Withdraw else TeamEnrollmentAction.Request))
        if (loseReply) error("lost reply")
        return TeamEnrollmentReceipt(current.id, current.teamId, current.teamInstanceId, requireNotNull(current.status), current.revision)
    }
}
