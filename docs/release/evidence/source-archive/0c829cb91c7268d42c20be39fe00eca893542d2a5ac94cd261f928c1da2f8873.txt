package be.sportgreenmoove.app.services

import kotlinx.coroutines.CancellationException
import org.junit.Assert.*
import org.junit.Test

class TeamPushJournalTest {
    private val identity = TeamPushIdentity("11223344-1234-4234-8234-123456789abc", "a".repeat(64))
    private val token = "synthetic_token_" + "T".repeat(80)
    private class Memory : TeamPushStorage {
        var record: TeamPushRecord? = null; var fail = false
        override fun read() = record
        override fun update(change: (TeamPushRecord?) -> TeamPushRecord): TeamPushRecord {
            val next = change(record); check(!fail) { "Synthetic storage failure" }; record = next; return next
        }
    }
    private fun journal(memory: Memory = Memory()) = TeamPushJournal(memory) { identity }
    private fun prepared(journal: TeamPushJournal, uid: String = "parent"): TeamPushCommand {
        journal.selectOwner(uid); return journal.completeToken(journal.reserveToken(uid), token)
    }
    private fun receipt(command: TeamPushCommand) = TeamPushReceipt(command.uid, command.revision, command.token != null, false)

    @Test fun confirmedRegistrationRequiresAnActualMatchingAcknowledgement() {
        val journal = journal(); val command = prepared(journal)
        assertFalse(journal.confirmedFor("parent")); journal.acknowledge(command, receipt(command))
        assertTrue(journal.confirmedFor("parent")); assertFalse(journal.confirmedFor("driver"))
        assertNull(journal.current().pending); assertEquals(teamPushHash(token), journal.current().confirmed?.tokenHash)
    }
    @Test fun unconfirmedRequestsSurviveReconstructionWithoutAllocatingAnotherRevision() {
        val memory = Memory(); val first = journal(memory); val command = prepared(first)
        val restored = journal(memory)
        assertEquals(command, restored.pendingFor("parent")); assertEquals(command.revision, restored.current().revision)
        assertFalse(restored.confirmedFor("parent"))
    }
    @Test fun accountSwitchDropsAnOldActivationAndRequiresProviderTokenDeletion() {
        val journal = journal(); val command = prepared(journal); journal.selectOwner("driver")
        assertNull(journal.current().pending); assertTrue(journal.current().needsTokenDeletion)
        assertThrows(IllegalStateException::class.java) { journal.reserveToken("driver") }
        assertThrows(CancellationException::class.java) { journal.acknowledge(command, receipt(command)) }
        journal.confirmTokenDeletion(journal.deletionTicket())
        val next = journal.completeToken(journal.reserveToken("driver"), token + "new")
        assertTrue(next.revision > command.revision); journal.acknowledge(next, receipt(next))
        assertTrue(journal.confirmedFor("driver")); assertFalse(journal.confirmedFor("parent"))
    }
    @Test fun laterTokenRetrievalWinsAndAnOlderCallbackCannotReplaceIt() {
        val journal = journal(); journal.selectOwner("parent")
        val old = journal.reserveToken("parent"); val fresh = journal.reserveToken("parent")
        val command = journal.completeToken(fresh, token + "fresh")
        assertThrows(CancellationException::class.java) { journal.completeToken(old, token) }
        assertEquals(command, journal.pendingFor("parent"))
    }
    @Test fun duplicateCallbacksCannotChangeThePayloadOfAnAlreadyPersistedRevision() {
        val journal = journal(); journal.selectOwner("parent"); val ticket = journal.reserveToken("parent")
        val command = journal.completeToken(ticket, token)
        assertEquals(command, journal.completeToken(ticket, token))
        assertThrows(CancellationException::class.java) { journal.completeToken(ticket, token + "other") }
        assertEquals(command, journal.pendingFor("parent"))
    }
    @Test fun aCallbackCannotReactivateAnAlreadyAcknowledgedRevision() {
        val journal = journal(); journal.selectOwner("parent"); val ticket = journal.reserveToken("parent")
        val command = journal.completeToken(ticket, token); journal.acknowledge(command, receipt(command))
        assertThrows(CancellationException::class.java) { journal.completeToken(ticket, token) }
        assertThrows(CancellationException::class.java) { journal.completeToken(ticket, token + "other") }
        assertTrue(journal.confirmedFor("parent")); assertNull(journal.pendingFor("parent"))
    }
    @Test fun invalidAccountIdentifiersNeverCreateOrChangeAnInstallation() {
        val memory = Memory(); val journal = journal(memory)
        for (uid in listOf("", " ", ".", "..", "__reserved__", "parent/child", "bad\nuid", "x".repeat(129)))
            assertThrows(IllegalArgumentException::class.java) { journal.selectOwner(uid) }
        assertNull(memory.record)
    }
    @Test fun returningToTheSameAccountDoesNotAcceptItsEarlierSessionCallback() {
        val journal = journal(); journal.selectOwner("parent"); val old = journal.reserveToken("parent")
        journal.selectOwner(null); journal.selectOwner("parent")
        assertThrows(CancellationException::class.java) { journal.completeToken(old, token) }
        assertTrue(journal.current().needsTokenDeletion); assertFalse(journal.confirmedFor("parent"))
    }
    @Test fun removalSurvivesLogoutButCannotBeSentWithAnotherAccount() {
        val journal = journal(); prepared(journal); val removal = journal.remove("parent"); journal.selectOwner(null)
        assertEquals(removal, journal.pendingFor("parent")); assertTrue(journal.current().needsTokenDeletion)
        assertThrows(CancellationException::class.java) { journal.pendingFor("driver") }
        journal.acknowledge(removal, receipt(removal)); assertNull(journal.current().pending)
        assertTrue(journal.current().needsTokenDeletion); assertFalse(journal.confirmedFor("parent"))
    }
    @Test fun delayedRemovalCannotAcknowledgeOrClearTheNewOwnersActivation() {
        val journal = journal(); prepared(journal); val removal = journal.remove("parent")
        journal.selectOwner("driver"); journal.confirmTokenDeletion(journal.deletionTicket())
        val next = journal.completeToken(journal.reserveToken("driver"), token + "driver")
        assertThrows(CancellationException::class.java) { journal.acknowledge(removal, receipt(removal)) }
        assertEquals(next, journal.pendingFor("driver"))
    }
    @Test fun anOlderDeletionCompletionCannotClearANewerDeletionBarrier() {
        val journal = journal(); prepared(journal); journal.selectOwner(null); val old = journal.deletionTicket()
        journal.selectOwner("driver")
        assertThrows(CancellationException::class.java) { journal.confirmTokenDeletion(old) }
        assertTrue(journal.current().needsTokenDeletion)
    }
    @Test fun malformedOrForeignAcknowledgementsNeverConfirmThePendingRequest() {
        val journal = journal(); val command = prepared(journal)
        for (wrong in listOf(receipt(command).copy(uid = "other"), receipt(command).copy(revision = command.revision + 1), receipt(command).copy(active = false)))
            assertThrows(IllegalStateException::class.java) { journal.acknowledge(command, wrong) }
        assertEquals(command, journal.pendingFor("parent")); assertFalse(journal.confirmedFor("parent"))
    }
    @Test fun failedDurableWriteDoesNotPublishAnUnpersistedCommandOrAdvanceTheCounter() {
        val memory = Memory(); val journal = journal(memory); journal.selectOwner("parent"); val before = journal.current()
        memory.fail = true
        assertThrows(IllegalStateException::class.java) { journal.reserveToken("parent") }
        assertEquals(before, memory.record)
    }
    @Test fun exhaustedCountersCannotWrapOrReinitializeTheInstallation() {
        val memory = Memory().apply { record = TeamPushRecord(identity, teamPushMaximumRevision, "parent", 1) }
        assertThrows(IllegalStateException::class.java) { journal(memory).reserveToken("parent") }
        assertEquals(teamPushMaximumRevision, memory.record?.revision); assertEquals(identity, memory.record?.identity)
    }
    @Test fun invalidTokensDoNotReplaceTheCurrentPendingCommandAndSensitiveObjectsAreRedacted() {
        val journal = journal(); val command = prepared(journal)
        assertThrows(IllegalArgumentException::class.java) { journal.completeToken(TeamPushTicket("parent", command.epoch, command.revision), "bad") }
        assertEquals(command, journal.pendingFor("parent"))
        for (description in listOf(identity.toString(), command.toString(), journal.current().toString())) {
            assertFalse(description.contains(identity.proof)); assertFalse(description.contains(token))
        }
    }
}
