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

class TeamEnrollmentHistoryFlowTest {
    @get:Rule val compose = createComposeRule()
    @Test fun historyIsReachableWithoutActiveClubChoicesAndContinuesPastTwentyRows() {
        val fixture = HistoryUiFixture(); host(fixture)
        compose.onNodeWithTag("team-enrollment.review").assertIsNotEnabled()
        openHistory(); click("team-history.more"); waitFor(hasTestTag("team-history.row.${fixture.rows.last().id}"))
        assertEquals(2, fixture.pageReads); assertTrue(fixture.writes.isEmpty())
        capture("team-history-paging.png")
    }
    @Test fun cancellingConfirmationDoesNotWriteAndConfirmedWithdrawalIsVisible() {
        val fixture = HistoryUiFixture(); host(fixture); openHistory(); click("team-history.row.${fixture.rows.first().id}")
        click("team-history.withdraw"); click("team-history.keep"); assertTrue(fixture.writes.isEmpty())
        click("team-history.withdraw"); click("team-history.confirm"); waitFor(hasText("Retrait enregistré.", substring = false))
        compose.onNodeWithTag("team-history.status").assertTextEquals("Inscription retirée")
        compose.onNodeWithTag("team-history.withdraw").assertDoesNotExist(); assertEquals(1, fixture.writes.size)
    }
    @Test fun uncertainWithdrawalHasNoSecondWriteUntilTheUserReadsTheRequestAgain() {
        val fixture = HistoryUiFixture().apply { loseReply = true }; host(fixture); openHistory()
        val id = fixture.rows.first().id; click("team-history.row.$id"); click("team-history.withdraw"); click("team-history.confirm")
        waitFor(hasTestTag("team-history.error")); compose.onNodeWithTag("team-history.withdraw").assertDoesNotExist()
        assertEquals(1, fixture.writes.size); click("team-history.row.$id")
        compose.onNodeWithTag("team-history.status").assertTextEquals("Inscription retirée")
        compose.onNodeWithTag("team-history.withdraw").assertDoesNotExist(); assertEquals(1, fixture.writes.size)
    }
    @Test fun redactedChildHistoryHasNoWithdrawalAndFitsNarrowLargeText() {
        val fixture = HistoryUiFixture().apply { rows[0] = rows[0].copy(childId = "child", subjectId = "child",
            teamName = "Équipe des jeunes de la Croix Saint-Lambert QA", allowedActions = emptyList()) }
        host(fixture, true); openHistory(); val tag = "team-history.row.${fixture.rows.first().id}"
        val bounds = compose.onNodeWithTag(tag).performScrollTo().fetchSemanticsNode().boundsInRoot
        val frame = compose.onNodeWithTag("team-history.narrow").fetchSemanticsNode().boundsInRoot
        assertTrue(bounds.left >= frame.left && bounds.right <= frame.right)
        click(tag); compose.onNodeWithTag("team-history.subject").assertTextEquals("Enfant indisponible").assertIsDisplayed()
        compose.onNodeWithTag("team-history.withdraw").assertDoesNotExist()
        compose.onNodeWithTag("team-history.close").assertIsDisplayed(); capture("team-history-redacted-child.png")
        assertTrue(fixture.writes.isEmpty())
    }
    private fun host(fixture: HistoryUiFixture, narrow: Boolean = false) {
        compose.setSgmUiTestContent {
            if (narrow) {
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.3f)) {
                    Box(Modifier.width(320.dp).testTag("team-history.narrow")) { TeamEnrollmentRoute("parent", fixture, true, {}) }
                }
            } else TeamEnrollmentRoute("parent", fixture, true, {})
        }
        waitFor(hasTestTag("team-enrollment.history") and isEnabled())
    }
    private fun openHistory() { click("team-enrollment.history"); waitFor(hasTestTag("team-history.screen")); waitFor(hasTestTag("team-history.row.${1.toString(16).padStart(64, '0')}")) }
    private fun click(tag: String) {
        waitFor(hasTestTag(tag) and isEnabled())
        val node = compose.onNodeWithTag(tag)
        if (!tag.startsWith("team-history.") || tag.startsWith("team-history.row.") || tag == "team-history.more") node.performScrollTo()
        node.performClick()
    }
    private fun waitFor(matcher: SemanticsMatcher) { compose.waitUntil(60_000) { compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty() } }
    private fun capture(name: String) {
        captureLocalUi(compose, name)
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val device = UiDevice.getInstance(instrumentation)
        val source = File(instrumentation.targetContext.getExternalFilesDir(null), "local-ui-evidence")
        val window = name.removeSuffix(".png") + "-window.png"; check(device.takeScreenshot(File(source, window)))
        check(device.executeShellCommand("mkdir -p /sdcard/Download/sgm-team-history").isBlank())
        for (file in listOf(name, window)) {
            val original = File(source, file); val target = "/sdcard/Download/sgm-team-history/$file"
            check(original.isFile && original.length() > 0 && Regex("[A-Za-z0-9/_.-]+").matches(original.absolutePath))
            check(device.executeShellCommand("cp ${original.absolutePath} $target").isBlank())
            val hash = MessageDigest.getInstance("SHA-256").digest(original.readBytes()).joinToString("") { "%02x".format(it) }
            val observed = device.executeShellCommand("sha256sum $target").trim().split(Regex("\\s+"))
            check(observed == listOf(hash, target))
        }
    }
}

private class HistoryUiFixture : TeamEnrollmentGateway {
    val rows = (1..25).map { i -> TeamEnrollmentView(i.toString(16).padStart(64, '0'), "team-$i", "club", "b".repeat(64),
        "Équipe fictive QA $i", "parent", null, null, TeamEnrollmentStatus.Approved, 4, false,
        listOf(TeamEnrollmentAction.Withdraw)) }.toMutableList()
    val writes = mutableListOf<String>(); var loseReply = false; var pageReads = 0
    override suspend fun teamOptions(uid: String, kind: TeamEnrollmentOptionKind, contextId: String?, cursor: String?) = GuardianPage<GuardianOption>(emptyList(), null)
    override suspend fun teamEnrollmentView(uid: String, teamId: String, childId: String?): TeamEnrollmentView = error("No active club access in this fixture")
    override suspend fun changeTeamEnrollment(uid: String, expected: TeamEnrollmentView, action: TeamEnrollmentAction, requestId: String): TeamEnrollmentReceipt = error("Not an owned-history operation")
    override suspend fun ownedTeamEnrollments(uid: String, cursor: String?): GuardianPage<TeamEnrollmentView> {
        pageReads++; return if (cursor == null) GuardianPage(rows.take(20), "next") else GuardianPage(rows.drop(20), null)
    }
    override suspend fun ownedTeamEnrollmentView(uid: String, enrollmentId: String) = rows.single { it.id == enrollmentId }
    override suspend fun withdrawOwnedTeamEnrollment(uid: String, expected: TeamEnrollmentView, requestId: String): TeamEnrollmentReceipt {
        writes += requestId; val index = rows.indexOfFirst { it.id == expected.id }
        rows[index] = expected.copy(status = TeamEnrollmentStatus.Withdrawn, revision = expected.revision + 1, allowedActions = emptyList())
        if (loseReply) error("Lost reply")
        return TeamEnrollmentReceipt(expected.id, expected.teamId, expected.teamInstanceId, TeamEnrollmentStatus.Withdrawn, expected.revision + 1)
    }
}
