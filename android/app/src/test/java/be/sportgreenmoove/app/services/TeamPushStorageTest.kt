package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.concurrent.Executors

class TeamPushStorageTest {
    @get:Rule val temporary = TemporaryFolder()
    private val token = "synthetic_" + "T".repeat(80)
    private fun path(root: File) = File(root, "registration.properties")
    @Test fun privateFileRestoresTheExactUnconfirmedRequestAndClearsOnlyAfterAcknowledgement() {
        val root = temporary.newFolder(); val first = TeamPushJournal(FileTeamPushStorage(root)); first.selectOwner("parent")
        val command = first.completeToken(first.reserveToken("parent"), token)
        val restored = TeamPushJournal(FileTeamPushStorage(root)); assertEquals(command, restored.pendingFor("parent"))
        restored.acknowledge(command, TeamPushReceipt("parent", command.revision, true, true))
        val final = TeamPushJournal(FileTeamPushStorage(root)); assertTrue(final.confirmedFor("parent")); assertNull(final.current().pending)
        assertFalse(path(root).readText().contains(token)); assertEquals(1, root.listFiles()!!.size)
    }
    @Test fun corruptedRecordsRemainUntouchedAndAreNeverReplacedWithAFreshIdentity() {
        val root = temporary.newFolder(); val file = path(root); file.writeText("proof=private-corrupt-value\n")
        val before = file.readBytes(); val journal = TeamPushJournal(FileTeamPushStorage(root))
        val failure = assertThrows(IllegalStateException::class.java) { journal.selectOwner("parent") }
        assertEquals("Invalid private phone registration", failure.message); assertArrayEquals(before, file.readBytes())
    }
    @Test fun duplicateUnknownMalformedAndTrailingStateCannotBeSilentlyNormalized() {
        val journal = TeamPushJournal(FileTeamPushStorage(temporary.newFolder())); journal.selectOwner("parent")
        val raw = TeamPushRecordCodec.encode(journal.current())
        for (bad in listOf(raw + "ownerUid=other\n", raw + "extra=value\n", raw.replace("revision=1", "revision=1.5"),
            raw.replace("needsTokenDeletion=false", "needsTokenDeletion=maybe"), raw.replace("version=1", "version=2")))
            assertThrows(IllegalStateException::class.java) { TeamPushRecordCodec.decode(bad) }
    }
    @Test fun logoutRemovalAndDeletionBarrierSurviveNewStorageInstances() {
        val root = temporary.newFolder(); val first = TeamPushJournal(FileTeamPushStorage(root)); first.selectOwner("parent")
        val removal = first.remove("parent"); first.selectOwner(null)
        val restored = TeamPushJournal(FileTeamPushStorage(root)); assertEquals(removal, restored.pendingFor("parent")); assertTrue(restored.current().needsTokenDeletion)
    }
    @Test fun impossibleActivationAndConfirmationStatesFailRatherThanBeingRepaired() {
        val journal = TeamPushJournal(FileTeamPushStorage(temporary.newFolder())); journal.selectOwner("parent")
        val command = journal.completeToken(journal.reserveToken("parent"), token); val record = journal.current()
        for (bad in listOf(record.copy(needsTokenDeletion = true), record.copy(revision = record.revision + 1),
            record.copy(pending = command.copy(epoch = command.revision + 1))))
            assertThrows(IllegalArgumentException::class.java) { TeamPushRecordCodec.encode(bad) }
        journal.acknowledge(command, TeamPushReceipt("parent", command.revision, true, false))
        assertThrows(IllegalArgumentException::class.java) { TeamPushRecordCodec.encode(journal.current().copy(revision = record.revision + 1)) }
    }
    @Test fun twoInstancesReserveUniqueMonotonicRevisionsWithoutLostWrites() {
        val root = temporary.newFolder(); val one = TeamPushJournal(FileTeamPushStorage(root)); one.selectOwner("parent")
        val two = TeamPushJournal(FileTeamPushStorage(root)); val executor = Executors.newFixedThreadPool(2)
        try {
            val revisions = (0 until 20).map { index -> executor.submit<Long> { (if(index % 2 == 0) one else two).reserveToken("parent").revision } }.map { it.get() }
            assertEquals((2L..21L).toSet(), revisions.toSet()); assertEquals(21L, one.current().revision)
        } finally { executor.shutdownNow() }
    }
}
