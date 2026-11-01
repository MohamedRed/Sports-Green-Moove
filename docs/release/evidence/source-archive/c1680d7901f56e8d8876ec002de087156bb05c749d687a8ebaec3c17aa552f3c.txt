package be.sportgreenmoove.app.services

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.StringReader
import java.io.StringWriter
import java.util.Properties

class TeamPushSignOutDurabilityTest {
    @get:Rule val temporary = TemporaryFolder()
    private fun controller(root: File, fixture: TeamPushTestFixture): TeamPushLifecycle = TeamPushLifecycle(
        TeamPushJournal(FileTeamPushStorage(root)), fixture.source, { fixture.uid }, { fixture.adult }, {
            fixture.calls += it; fixture.callAction(it)
        })
    private fun legacy(record: TeamPushRecord): String = StringWriter().also { writer ->
        Properties().apply {
            load(StringReader(TeamPushRecordCodec.encode(record))); remove("signOutUid"); setProperty("version", "1"); store(writer, null)
        }
    }.toString()

    @Test fun acknowledgedRemovalStillPreventsAutomaticSessionRestorationAfterReconstruction() = runBlocking {
        val root = temporary.newFolder(); val f = TeamPushTestFixture(); val first = controller(root, f)
        first.synchronize(true); assertEquals(SessionExitResult.Confirmed, first.prepareSignOut())
        val second = controller(root, f); assertTrue(second.requiresSignOut("parent"))
        assertEquals(TeamPushSyncResult.Inactive, second.synchronize(true)); assertEquals(1, f.retrieved)
        second.accountChanged(null); assertTrue(second.requiresSignOut("parent"))
        second.accountChanged("parent"); assertEquals(TeamPushSyncResult.Inactive, second.synchronize(true))
        second.authorizeSignIn("parent"); assertFalse(second.requiresSignOut("parent"))
        assertEquals(TeamPushSyncResult.Registered, second.synchronize(true)); assertEquals(2, f.retrieved)
    }
    @Test fun unacknowledgedRemovalSurvivesReconstructionAndIsReplayedOnlyAfterExplicitSignIn() = runBlocking {
        val root = temporary.newFolder(); val f = TeamPushTestFixture(); val first = controller(root, f)
        first.synchronize(true); f.callAction = { error("Synthetic offline") }
        assertEquals(SessionExitResult.Pending, first.prepareSignOut()); val original = f.calls.last()
        val second = controller(root, f); second.synchronize(true); assertEquals(original, f.calls.last())
        second.authorizeSignIn("parent"); f.callAction = { TeamPushReceipt(it.uid, it.revision, it.token != null, true) }
        second.synchronize(true)
        assertEquals(original, f.calls[f.calls.lastIndex - 1]); assertTrue(f.calls.last().revision > original.revision)
    }
    @Test fun aKnownVersionOneSignedOutRemovalMigratesWithoutResettingIdentityOrCounters() {
        val f = TeamPushTestFixture(); f.journal.selectOwner("parent"); val removal = f.journal.remove("parent"); f.journal.selectOwner(null)
        val before = f.journal.current(); val migrated = TeamPushRecordCodec.decode(legacy(before))
        assertEquals("parent", migrated.signOutUid); assertEquals(before.identity, migrated.identity)
        assertEquals(before.revision, migrated.revision); assertEquals(removal, migrated.pending)
        assertEquals(migrated, TeamPushRecordCodec.decode(TeamPushRecordCodec.encode(migrated)))
    }
    @Test fun versionOnePermissionRemovalDoesNotBecomeAnAccountLogout() {
        val f = TeamPushTestFixture(); f.journal.selectOwner("parent"); f.journal.remove("parent")
        val migrated = TeamPushRecordCodec.decode(legacy(f.journal.current()))
        assertNull(migrated.signOutUid); assertEquals("parent", migrated.ownerUid)
    }
    @Test fun aDifferentIdentityCannotClearTheIntentWithoutAnActualMatchingSignIn() {
        val f = TeamPushTestFixture(); f.account("parent"); f.lifecycle.signedOut()
        assertThrows(IllegalStateException::class.java) { f.lifecycle.authorizeSignIn("driver") }
        assertEquals("parent", f.journal.current().signOutUid)
    }
    @Test fun failedIntentPersistenceDisablesAutoInitAndNeverSendsAnUnpersistedRemoval() = runBlocking {
        val f = TeamPushTestFixture(); f.lifecycle.synchronize(true); f.memory.failWrites = true
        try { f.lifecycle.prepareSignOut(); fail() } catch (_: IllegalStateException) { }
        assertFalse(f.autoInit); assertEquals(1, f.calls.size)
    }
}
