package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test
import java.security.MessageDigest

@OptIn(ExperimentalCoroutinesApi::class)
class ChildInvitationStateTest {
    private val target = ChildAccountLinkTarget("profile", "club", "b".repeat(64), "Enfant QA")
    private fun state(gateway: InvitationFixture) = ChildInvitationState("parent", target, gateway) { 100 }
    @Test fun sharingRequiresAnExplicitCreationAndKeepsApprovalSeparate() = runTest {
        val gateway = InvitationFixture(); val state = state(gateway); var shared: String? = null
        state.create(); assertEquals(0, gateway.creations); state.share { shared = it }; assertNull(shared)
        state.refresh(); assertTrue(state.canCreate); assertFalse(state.canShare)
        state.create(); assertTrue(state.canShare); assertEquals("pending", state.current?.status)
        state.share { shared = it }; assertEquals(gateway.link.url, shared); assertEquals(1, gateway.creations)
    }
    @Test fun theSelectedProfileAndApprovedHttpsFragmentCannotBeChangedByAResponse() = runTest {
        val original = InvitationFixture().link
        for (value in listOf(original.copy(childId = "another"), original.copy(childInstanceId = "c".repeat(64)),
            original.copy(url = original.url.replace("https:", "http:")),
            original.copy(url = original.url.replace("sports-green-moove-prod.web.app", "other.example")),
            original.copy(url = original.url.replace("#", "?token=")), original.copy(url = original.url + "bad"),
            original.copy(current = original.current.copy(invitationHash = "f".repeat(64))))) {
            val gateway = InvitationFixture(); gateway.link = value; val state = state(gateway)
            state.refresh(); state.create(); assertFalse(state.canShare); assertNotNull(state.error); assertFalse(state.loaded)
        }
    }
    @Test fun anExpiredLinkCannotBeShared() = runTest {
        var time = 100L; val gateway = InvitationFixture()
        val state = ChildInvitationState("parent", target, gateway) { time }
        state.refresh(); state.create(); assertTrue(state.canShare); time = 200
        var shares = 0; state.share { shares++ }; assertEquals(0, shares); assertFalse(state.canShare)
    }
    @Test fun doubleTapsCannotCreateParallelInvitations() = runTest {
        val gateway = InvitationFixture(); gateway.pending = CompletableDeferred(); val state = state(gateway)
        state.refresh(); backgroundScope.launch { state.create() }; runCurrent()
        state.create(); assertEquals(1, gateway.creations); assertFalse(state.canShare)
        gateway.pending?.complete(gateway.link); runCurrent(); assertTrue(state.canShare)
    }
    @Test fun aLateResponseCannotRestoreTheSecretAfterLeavingForeground() = runTest {
        val gateway = InvitationFixture(); gateway.pending = CompletableDeferred(); val state = state(gateway)
        state.refresh(); backgroundScope.launch { state.create() }; runCurrent(); state.leaveForeground()
        gateway.pending?.complete(gateway.link); runCurrent()
        assertNull(state.current); assertFalse(state.canShare); assertFalse(state.loaded); assertFalse(state.busy)
    }
    @Test fun closingDisablesAllFutureMutationsAndSharing() = runTest {
        val gateway = InvitationFixture(); val state = state(gateway); state.refresh(); state.create(); state.close()
        state.refresh(); state.create(); state.revoke(); state.share { fail("Closed state shared an invitation") }
        assertEquals(1, gateway.creations); assertEquals(0, gateway.revocations); assertNull(state.current)
    }
    @Test fun anUncertainResponseRequiresAStatusRefreshAndNeverAssumesAnInvitationIsUsable() = runTest {
        val gateway = InvitationFixture(); val state = state(gateway); state.refresh(); gateway.fail = true; state.create()
        assertFalse(state.loaded); assertFalse(state.canCreate); assertFalse(state.canShare)
        state.create(); assertEquals(1, gateway.creations)
        gateway.fail = false; state.refresh(); assertTrue(state.canCreate); assertFalse(state.canShare)
    }
    @Test fun aConsumedInvitationCannotBeReplacedRevokedOrSharedFromOldState() = runTest {
        for (status in listOf("accepted", "provisioning")) {
            val gateway = InvitationFixture(); gateway.status = gateway.link.current.copy(status = status)
            val state = state(gateway); state.refresh(); state.create(); state.revoke()
            assertFalse(state.canCreate); assertFalse(state.canRevoke); assertFalse(state.canShare)
            assertEquals(0, gateway.creations); assertEquals(0, gateway.revocations)
        }
    }
    @Test fun revocationUsesTheDisplayedFingerprintAndErasesTheUsableLink() = runTest {
        val gateway = InvitationFixture(); val state = state(gateway); state.refresh(); state.create(); state.revoke()
        assertEquals(1, gateway.revocations); assertEquals(gateway.link.current.invitationHash, gateway.revoked)
        assertEquals("revoked", state.current?.status); assertFalse(state.canShare); assertTrue(state.canCreate)
    }
    @Test fun aStatusRefreshDoesNotReconstructOrCacheTheInvitationSecret() = runTest {
        val gateway = InvitationFixture(); val state = state(gateway); state.refresh(); state.create(); state.refresh()
        assertEquals("pending", state.current?.status); assertFalse(state.canShare)
    }
}

private class InvitationFixture : ChildInvitationGateway {
    private val token = "a".repeat(64)
    private val hash = MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it.toInt() and 255) }
    var link = ChildInvitationLink("profile", "b".repeat(64), "https://sports-green-moove-prod.web.app/child-invitation#$token",
        ChildInvitationStatus(hash, "pending", 200))
    var status: ChildInvitationStatus? = null
    var pending: CompletableDeferred<ChildInvitationLink>? = null
    var creations = 0; var revocations = 0; var revoked: String? = null; var fail = false
    override suspend fun current(uid: String, target: ChildAccountLinkTarget) = status
    override suspend fun create(uid: String, target: ChildAccountLinkTarget): ChildInvitationLink {
        creations++; if (fail) error("Synthetic unconfirmed response")
        val result = pending?.await() ?: link; status = result.current; return result
    }
    override suspend fun revoke(uid: String, target: ChildAccountLinkTarget, invitationHash: String) {
        revocations++; revoked = invitationHash; status = requireNotNull(status).copy(status = "revoked")
    }
}
