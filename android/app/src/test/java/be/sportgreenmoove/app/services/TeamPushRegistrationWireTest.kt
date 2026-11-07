package be.sportgreenmoove.app.services

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

class TeamPushRegistrationWireTest {
    private val identity = TeamPushIdentity("11223344-1234-4234-8234-123456789abc", "a".repeat(64))
    private val command = TeamPushCommand(identity, "parent", 1, 2, "synthetic_" + "T".repeat(80))
    private fun response() = mapOf("currentUserId" to "parent", "revision" to 2.0, "active" to true, "reused" to false)
    @Test fun callablePayloadContainsOnlyTheStrictServerFieldsWithoutAClientChosenUserId() = runTest {
        val gateway = AccountBoundTeamPushRegistration({ "parent" }) { payload ->
            assertEquals(setOf("installationId", "installationSecret", "revision", "platform", "token"), payload.keys)
            assertEquals("android", payload["platform"]); response()
        }
        assertEquals(TeamPushReceipt("parent", 2, true, false), gateway.register(command))
    }
    @Test fun aDifferentOrEndedAccountCannotStartTheCallable() = runTest {
        for (uid in listOf("other", null)) {
            var calls = 0; val gateway = AccountBoundTeamPushRegistration({ uid }) { calls++; response() }
            try { gateway.register(command); fail("Expected ended owner") } catch (_: CancellationException) { }
            assertEquals(0, calls)
        }
    }
    @Test fun switchingDuringTheCallCannotAcknowledgeTheOldOwner() = runTest {
        var uid = "parent"; val gateway = AccountBoundTeamPushRegistration({ uid }) { uid = "driver"; response() }
        try { gateway.register(command); fail("Expected account change") } catch (_: CancellationException) { }
    }
    @Test fun malformedForeignFractionalAndUnknownResponsesFailClosed() {
        for (raw in listOf(null, response() - "active", response() + ("currentUserId" to "other"), response() + ("revision" to 2.5),
            response() + ("revision" to Double.NaN), response() + ("revision" to 3), response() + ("active" to false),
            response() + ("reused" to "false"), response() + ("secret" to "unexpected")))
            assertThrows(IllegalStateException::class.java) { parseTeamPushReceipt(raw, command) }
    }
    @Test fun explicitRemovalRequiresAnInactiveConfirmationAndPreservesExactReplayIdentity() {
        val removal = command.copy(token = null)
        assertEquals(TeamPushReceipt("parent", 2, false, true), parseTeamPushReceipt(response() + mapOf("active" to false, "reused" to true), removal))
        assertThrows(IllegalStateException::class.java) { parseTeamPushReceipt(response(), removal) }
    }
    @Test fun aCallFailureIsNotConvertedIntoSuccessOrAnEmptyRegistration() = runTest {
        val failure = IllegalStateException("Synthetic callable failure")
        try { AccountBoundTeamPushRegistration({ "parent" }) { throw failure }.register(command); fail("Expected failure") }
        catch (actual: IllegalStateException) { assertSame(failure, actual) }
    }
}
