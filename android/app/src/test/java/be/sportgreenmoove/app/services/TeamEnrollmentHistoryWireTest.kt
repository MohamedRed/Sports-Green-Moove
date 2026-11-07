package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import org.junit.Assert.*
import org.junit.Test

class TeamEnrollmentHistoryWireTest {
    private fun row() = mapOf<String, Any?>("id" to "a".repeat(64), "requesterUserId" to "parent", "teamId" to "team",
        "clubId" to "club", "teamInstanceId" to "b".repeat(64), "teamName" to "Équipe QA", "subjectKind" to "member",
        "subjectId" to "parent", "subjectName" to null, "status" to "approved", "revision" to 4,
        "eligible" to false, "allowedActions" to listOf("withdraw"))
    @Test fun anOwnedAdultCanReviewWithdrawalWithoutCurrentClubEligibilityOrLabels() {
        val view = TeamEnrollmentHistoryWire.view(row(), "parent", "a".repeat(64))
        assertFalse(view.eligible); assertNull(view.subjectName)
        assertEquals(listOf(TeamEnrollmentAction.Withdraw), view.allowedActions)
    }
    @Test fun historyCannotDecodeAnotherRequestingAccountOrAnUnexpectedRecordIdentity() {
        for (patch in listOf(mapOf("requesterUserId" to "other"), mapOf("subjectId" to "other"),
            mapOf("id" to "short"), mapOf("subjectKind" to "unknown")))
            assertThrows(Exception::class.java) { TeamEnrollmentHistoryWire.item(row() + patch, "parent") }
        assertThrows(Exception::class.java) { TeamEnrollmentHistoryWire.view(row(), "parent", "c".repeat(64)) }
    }
    @Test fun historyNeverCreatesAnEmptyRequestOrExposesRequestApprovalCapabilities() {
        for (patch in listOf(mapOf("status" to null, "revision" to 0), mapOf("allowedActions" to listOf("request"), "eligible" to true),
            mapOf("allowedActions" to listOf("approve")), mapOf("allowedActions" to listOf("withdraw", "withdraw"))))
            assertThrows(Exception::class.java) { TeamEnrollmentHistoryWire.item(row() + patch, "parent") }
    }
    @Test fun anIneligibleChildCannotExposeANameOrApprovedWithdrawal() {
        val child = row() + mapOf("subjectKind" to "child", "subjectId" to "child", "allowedActions" to emptyList<String>())
        assertNull(TeamEnrollmentHistoryWire.item(child, "parent").subjectName)
        assertThrows(Exception::class.java) { TeamEnrollmentHistoryWire.item(child + mapOf("subjectName" to "Private child"), "parent") }
        assertThrows(Exception::class.java) { TeamEnrollmentHistoryWire.item(child + mapOf("allowedActions" to listOf("withdraw")), "parent") }
    }
    @Test fun theRequestingParentCanWithdrawAPendingRedactedChildRequest() {
        val child = row() + mapOf("subjectKind" to "child", "subjectId" to "child", "status" to "requested")
        val view = TeamEnrollmentHistoryWire.item(child, "parent")
        assertEquals("child", view.childId); assertNull(view.subjectName)
        assertEquals(listOf(TeamEnrollmentAction.Withdraw), view.allowedActions)
    }
    @Test fun closedHistoryHasNoActionAndMalformedRevisionsRemainErrors() {
        val closed = row() + mapOf("status" to "withdrawn", "allowedActions" to emptyList<String>())
        assertTrue(TeamEnrollmentHistoryWire.item(closed, "parent").allowedActions.isEmpty())
        for (value in listOf(0, -1, 1.5, Double.NaN))
            assertThrows(Exception::class.java) { TeamEnrollmentHistoryWire.item(closed + mapOf("revision" to value), "parent") }
    }
}
