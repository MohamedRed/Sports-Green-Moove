package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChildAccountLinkStateTest {
    private val target = ChildAccountLinkTarget("profile", "club", "b".repeat(64), "Enfant QA")
    @Test fun childCodeMustBelongToTheCurrentAccountAndBeUnexpired() = runTest {
        for (value in listOf(ChildAccountLinkCode("other", "a".repeat(32), 200),
            ChildAccountLinkCode("child", "a".repeat(32), 100), ChildAccountLinkCode("child", "unsafe", 200))) {
            val gateway = LinkFixture(); gateway.code = value
            val state = ChildAccountLinkState("child", null, gateway) { 100 }
            state.create(); assertNull(state.code); assertNotNull(state.error)
        }
    }
    @Test fun aLateCodeCannotReappearAfterLeavingForeground() = runTest {
        val gateway = LinkFixture(); val pending = CompletableDeferred<ChildAccountLinkCode>(); gateway.pending = pending
        val state = ChildAccountLinkState("child", null, gateway) { 100 }
        backgroundScope.launch { state.create() }; runCurrent()
        state.leaveForeground(); pending.complete(gateway.code); runCurrent()
        assertNull(state.code); assertNull(state.error); assertFalse(state.busy)
    }
    @Test fun creatingACodeNeverApprovesAnAccountOrUsesTheParentEndpoint() = runTest {
        val gateway = LinkFixture(); val state = ChildAccountLinkState("child", null, gateway) { 100 }
        state.create(); assertEquals(gateway.code, state.code); assertFalse(state.canApprove)
        state.approve(); assertEquals(0, gateway.approvals)
    }
    @Test fun parentCannotRequestAChildCodeOrSubmitAnInvalidTruncatedCode() = runTest {
        val gateway = LinkFixture(); val state = ChildAccountLinkState("parent", target, gateway)
        state.create(); assertEquals(0, gateway.creations)
        state.edit("a".repeat(33)); assertFalse(state.canApprove); state.approve(); assertEquals(0, gateway.approvals)
    }
    @Test fun parentApprovalUsesTheSelectedImmutableIdentityAndClearsThePairingSecret() = runTest {
        val gateway = LinkFixture(); val state = ChildAccountLinkState("parent", target, gateway)
        state.edit(" AAAAAAAA\nAAAAAAAA AAAAAAAA\nAAAAAAAA "); assertTrue(state.canApprove)
        state.approve(); assertEquals(target, gateway.target); assertEquals("a".repeat(32), gateway.submitted)
        assertTrue(state.approved); assertEquals("", state.input); assertFalse(state.canApprove)
        state.approve(); assertEquals(1, gateway.approvals)
    }
    @Test fun anUnrelatedReceiptCannotConfirmTheSelectedChild() = runTest {
        val gateway = LinkFixture(); gateway.receipt = gateway.receipt.copy(childId = "another-child")
        val state = ChildAccountLinkState("parent", target, gateway); state.edit("a".repeat(32)); state.approve()
        assertFalse(state.approved); assertNotNull(state.error)
    }
    @Test fun aSelfLinkReceiptCannotApproveTheParentAccount() = runTest {
        val gateway = LinkFixture(); gateway.receipt = gateway.receipt.copy(accountUserId = "parent")
        val state = ChildAccountLinkState("parent", target, gateway); state.edit("a".repeat(32)); state.approve()
        assertFalse(state.approved); assertNotNull(state.error)
    }
    @Test fun leavingTheDialogErasesInputAndPreventsFutureOperations() = runTest {
        val gateway = LinkFixture(); val state = ChildAccountLinkState("parent", target, gateway)
        state.edit("a".repeat(32)); state.close(); assertEquals("", state.input)
        state.edit("b".repeat(32)); state.approve(); assertEquals("", state.input); assertEquals(0, gateway.approvals)
    }
    @Test fun expiryRemovesTheCodeRatherThanKeepingItVisibleAsUsable() = runTest {
        var time = 100L; val state = ChildAccountLinkState("child", null, LinkFixture()) { time }
        state.create(); assertNotNull(state.code); time = 200; state.expireCode(); assertNull(state.code)
    }
    @Test fun anotherTapCannotEraseOrReplaceAVisibleUnexpiredCode() = runTest {
        val gateway = LinkFixture(); val state = ChildAccountLinkState("child", null, gateway) { 100 }
        state.create(); state.create()
        assertEquals(1, gateway.creations); assertEquals(gateway.code, state.code); assertNull(state.error)
    }
    @Test fun networkFailureNeedsAnExplicitParentRetryAndNeverShowsSuccess() = runTest {
        val gateway = LinkFixture(); gateway.fail = true
        val state = ChildAccountLinkState("parent", target, gateway); state.edit("a".repeat(32)); state.approve()
        assertFalse(state.approved); assertEquals(1, gateway.approvals); assertTrue(state.canApprove)
        gateway.fail = false; state.approve(); assertTrue(state.approved); assertEquals(2, gateway.approvals)
    }
}

private class LinkFixture : ChildAccountLinkGateway {
    var code = ChildAccountLinkCode("child", "a".repeat(32), 200)
    var receipt = ChildAccountLinkReceipt("child", "profile", "b".repeat(64))
    var pending: CompletableDeferred<ChildAccountLinkCode>? = null
    var creations = 0; var approvals = 0; var fail = false
    var target: ChildAccountLinkTarget? = null; var submitted: String? = null
    override suspend fun createCode(uid: String): ChildAccountLinkCode { creations++; return pending?.await() ?: code }
    override suspend fun approve(uid: String, target: ChildAccountLinkTarget, code: String): ChildAccountLinkReceipt {
        approvals++; this.target = target; submitted = code; if (fail) error("Synthetic lost response")
        return receipt
    }
}
