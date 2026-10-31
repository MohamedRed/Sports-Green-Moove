package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*
import org.junit.Assert.*
import org.junit.Test

class TeamEnrollmentWireTest {
    private val value: Map<String, Any?> = mapOf("id" to "a".repeat(64), "teamId" to "team", "clubId" to "club",
        "teamInstanceId" to "b".repeat(64), "teamName" to "Equipe QA", "subjectId" to "parent", "subjectKind" to "member",
        "subjectName" to "Parent QA", "status" to null, "revision" to 0, "eligible" to true, "allowedActions" to listOf("request"))
    @Test fun selfAndChildResponsesBindExactTargetAndSeparateStatusFromEligibility() {
        val self = TeamEnrollmentWire.view(value, "parent", "team", null)
        assertEquals("parent", self.subjectId); assertEquals(0L, self.revision); assertNull(self.status)
        val child = TeamEnrollmentWire.view(value + mapOf("subjectId" to "child", "subjectKind" to "child"), "parent", "team", "child")
        assertEquals("child", child.childId)
    }
    @Test fun malformedOwnershipIdentityVersionAndCapabilityNeverProduceAConfirmedView() {
        for (patch in listOf(mapOf("subjectId" to "other"), mapOf("subjectKind" to "child"), mapOf("teamId" to "other"),
            mapOf("revision" to 1), mapOf("status" to "approved"), mapOf("eligible" to false), mapOf("eligible" to "yes"),
            mapOf("id" to "legacy"), mapOf("teamInstanceId" to "bad"), mapOf("allowedActions" to listOf("approve")),
            mapOf("allowedActions" to listOf("request", "request")), mapOf("revision" to Double.NaN), mapOf("teamName" to "bad\u202ename")))
            assertThrows(Exception::class.java) { TeamEnrollmentWire.view(value + patch, "parent", "team", null) }
    }
    @Test fun requestPayloadCarriesOnlyViewedIdentityVersionAndOperationId() {
        val view = TeamEnrollmentWire.view(value, "parent", "team", null)
        val payload = TeamEnrollmentWire.payload(view, TeamEnrollmentAction.Request, "b1978015-6f6e-4ef2-b30e-4a36ad5ebcb8")
        assertEquals(view.id, payload["expectedEnrollmentId"]); assertEquals(view.teamInstanceId, payload["expectedTeamInstanceId"])
        assertFalse(payload.containsKey("userId")); assertFalse(payload.containsKey("clubId")); assertFalse(payload.containsKey("approved"))
        assertThrows(Exception::class.java) { TeamEnrollmentWire.payload(view, TeamEnrollmentAction.Withdraw, "bad") }
    }
    @Test fun receiptsMustAdvanceThisExactEnrollmentIdentity() {
        val view = TeamEnrollmentWire.view(value, "parent", "team", null)
        val receipt: Map<String, Any> = mapOf("enrollmentId" to view.id, "teamId" to view.teamId, "teamInstanceId" to view.teamInstanceId,
            "revision" to 1, "status" to "requested", "replayed" to false)
        assertEquals(1L, TeamEnrollmentWire.receipt(receipt, view).revision)
        for (patch in listOf(mapOf("teamInstanceId" to "c".repeat(64)), mapOf("enrollmentId" to "c".repeat(64)),
            mapOf("teamId" to "other"), mapOf("revision" to 0), mapOf("replayed" to "yes")))
            assertThrows(Exception::class.java) { TeamEnrollmentWire.receipt(receipt + patch, view) }
    }
}
