package be.sportgreenmoove.app.ui

import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.services.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class TeamPushPrivateStorageTest {
    @Test fun privateNoBackupStorageRestoresOneExactPendingRequestWithoutProviderCalls() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val root = File(context.noBackupFilesDir, "isolated-team-push-${System.nanoTime()}")
        try {
            val first = TeamPushJournal(FileTeamPushStorage(root)); first.selectOwner("synthetic-parent")
            val command = first.completeToken(first.reserveToken("synthetic-parent"), "synthetic_" + "T".repeat(80))
            val restored = TeamPushJournal(FileTeamPushStorage(root)); assertEquals(command, restored.pendingFor("synthetic-parent"))
            assertFalse(restored.confirmedFor("synthetic-parent")); assertTrue(root.canonicalPath.startsWith(context.noBackupFilesDir.canonicalPath + "/"))
            assertEquals(1, root.listFiles()!!.size)
        } finally { check(root.deleteRecursively()) }
    }
}
