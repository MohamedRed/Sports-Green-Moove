package be.sportgreenmoove.app.services

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class TeamPushSignOutTest {
    @Test fun authenticatedRemovalIsAcknowledgedBeforeAuthClearsTheAccount() = runTest {
        val f = TeamPushTestFixture(); f.lifecycle.synchronize(true)
        assertEquals(SessionExitResult.Confirmed, f.lifecycle.prepareSignOut())
        assertEquals("parent", f.uid); assertNull(f.journal.current().ownerUid); assertNull(f.journal.current().pending)
        assertNull(f.calls.last().token); assertFalse(f.autoInit); assertFalse(f.journal.confirmedFor("parent"))
        assertTrue(f.journal.current().needsTokenDeletion)
    }
    @Test fun anUnavailableServerRetainsPendingRemovalWithoutManufacturingConfirmation() = runTest {
        val f = TeamPushTestFixture(); f.lifecycle.synchronize(true); f.callAction = { error("Synthetic offline") }
        assertEquals(SessionExitResult.Pending, f.lifecycle.prepareSignOut())
        assertNull(f.journal.current().ownerUid); assertNotNull(f.journal.current().pending); assertFalse(f.autoInit)
    }
    @Test fun aSilentServerWaitIsBoundedToTwoAndAHalfSeconds() = runTest {
        val f = TeamPushTestFixture(); f.lifecycle.synchronize(true)
        f.callAction = { delay(20_000); error("Must not complete") }
        val operation = async { f.lifecycle.prepareSignOut() }; runCurrent()
        advanceTimeBy(2_499); runCurrent(); assertFalse(operation.isCompleted)
        advanceTimeBy(1); runCurrent(); assertEquals(SessionExitResult.Pending, operation.await())
        assertNotNull(f.journal.current().pending); assertFalse(f.autoInit)
    }
    @Test fun callerCancellationKeepsTheRemovalAndDoesNotLookLikeConfirmation() = runTest {
        val f = TeamPushTestFixture(); f.lifecycle.synchronize(true); val receipt = CompletableDeferred<TeamPushReceipt>()
        f.callAction = { receipt.await() }
        val operation = async { f.lifecycle.prepareSignOut() }; runCurrent(); operation.cancelAndJoin()
        assertTrue(operation.isCancelled); assertNotNull(f.journal.current().pending); assertNull(f.journal.current().ownerUid)
    }
    @Test fun aLateRegistrationReplyCannotReactivateTheInstallationDuringSignout() = runTest {
        val f = TeamPushTestFixture(); val receipt = CompletableDeferred<TeamPushReceipt>()
        f.callAction = { if (it.token != null) receipt.await() else TeamPushReceipt(it.uid, it.revision, false, false) }
        val activation = async { f.lifecycle.synchronize(true) }; runCurrent(); val old = f.calls.single()
        assertEquals(SessionExitResult.Confirmed, f.lifecycle.prepareSignOut())
        receipt.complete(TeamPushReceipt(old.uid, old.revision, true, false))
        try { activation.await(); fail() } catch (_: CancellationException) { }
        assertNull(f.journal.current().confirmed); assertNull(f.journal.current().pending); assertFalse(f.autoInit)
    }
    @Test fun anotherAccountsReceiptCannotClearThePendingRemoval() = runTest {
        val f = TeamPushTestFixture(); f.lifecycle.synchronize(true)
        f.callAction = { TeamPushReceipt("driver", it.revision, false, false) }
        assertEquals(SessionExitResult.Pending, f.lifecycle.prepareSignOut()); assertNotNull(f.journal.current().pending)
    }
    @Test fun accountChangeDuringRemovalCannotAcknowledgeAsTheNextUser() = runTest {
        val f = TeamPushTestFixture(); f.lifecycle.synchronize(true); val receipt = CompletableDeferred<TeamPushReceipt>()
        f.callAction = { receipt.await() }; val operation = async { f.lifecycle.prepareSignOut() }; runCurrent(); val removal = f.calls.last()
        f.account("driver"); receipt.complete(TeamPushReceipt(removal.uid, removal.revision, false, false))
        try { operation.await(); fail() } catch (_: CancellationException) { }
        assertNotNull(f.journal.current().pending); assertFalse(f.journal.confirmedFor("driver"))
    }
    @Test fun aSignedOutClientNeverReplaysAnUnauthenticatedPreviousOwnersRemoval() = runTest {
        val f = TeamPushTestFixture(); f.lifecycle.synchronize(true); f.lifecycle.signedOut(); f.account(null)
        val count = f.calls.size
        assertEquals(SessionExitResult.Pending, f.lifecycle.prepareSignOut()); assertEquals(count, f.calls.size)
    }
    @Test fun anInstallationWithoutAnyRegistrationHasNothingToConfirm() = runTest {
        val f = TeamPushTestFixture(); f.account(null)
        assertEquals(SessionExitResult.NoRegistration, f.lifecycle.prepareSignOut()); assertTrue(f.calls.isEmpty())
    }
    @Test fun forcedLocalSignoutAfterConfirmationDoesNotCreateAnExtraRemoval() = runTest {
        val f = TeamPushTestFixture(); f.lifecycle.synchronize(true)
        assertEquals(SessionExitResult.Confirmed, f.lifecycle.prepareSignOut()); val revision = f.journal.current().revision
        f.lifecycle.signedOut()
        assertEquals(revision, f.journal.current().revision); assertNull(f.journal.current().pending)
    }
}
