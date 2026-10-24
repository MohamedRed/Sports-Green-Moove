package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.SupportSubmission
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files
import java.util.UUID

class SupportSubmissionStoreTest {
    private val input = SupportSubmission("parent", UUID.randomUUID().toString(), "Aide", "Demande de test", true)
    @Test fun persistenceIsAccountScopedAndStaleAcknowledgeCannotClearIt() {
        val dir = Files.createTempDirectory("support-store-").toFile()
        try {
            FileSupportSubmissionStore(dir).begin(input)
            val reopened = FileSupportSubmissionStore(dir)
            assertEquals(input, reopened.read(input.uid)); assertNull(reopened.read("driver"))
            reopened.acknowledge(input.uid, UUID.randomUUID().toString()); assertEquals(input, reopened.read(input.uid))
            assertThrows(IllegalStateException::class.java) { reopened.begin(input.copy(requestId = UUID.randomUUID().toString())) }
            reopened.acknowledge(input.uid, input.requestId); assertNull(reopened.read(input.uid))
        } finally { dir.deleteRecursively() }
    }
    @Test fun corruptedOrForeignStoredContentFailsClosed() {
        val dir = Files.createTempDirectory("support-store-").toFile()
        try {
            val store = FileSupportSubmissionStore(dir); store.begin(input)
            val file = dir.listFiles()!!.single(); val original = file.readText()
            file.writeText(original.replace("uid=parent", "uid=driver"))
            assertThrows(IllegalStateException::class.java) { store.read("parent") }
            assertThrows(IllegalStateException::class.java) { store.begin(input) }
            file.writeText("corrupted")
            assertThrows(IllegalStateException::class.java) { store.read("parent") }
        } finally { dir.deleteRecursively() }
    }
    @Test fun failedWriteDoesNotCreateAnInMemoryReplacementIdentity() {
        val file = Files.createTempFile("support-file-", ".tmp").toFile()
        try {
            val store = FileSupportSubmissionStore(file)
            assertThrows(Exception::class.java) { store.begin(input) }
            assertTrue(file.isFile)
        } finally { file.delete() }
    }
    @Test fun receiptMustMatchAccountIdentityStatusAndShape() {
        val receipt = mapOf("requesterUserId" to input.uid, "clientRequestId" to input.requestId,
            "status" to "open", "reportId" to "a".repeat(64), "reused" to true)
        assertEquals("a".repeat(64), input.acknowledgedReport(receipt))
        for (patch in listOf(mapOf("requesterUserId" to "foreign"), mapOf("clientRequestId" to "different"),
            mapOf("status" to "closed"), mapOf("reportId" to "bad"), mapOf("reused" to "true")))
            assertThrows(IllegalStateException::class.java) { input.acknowledgedReport(receipt + patch) }
    }
}
