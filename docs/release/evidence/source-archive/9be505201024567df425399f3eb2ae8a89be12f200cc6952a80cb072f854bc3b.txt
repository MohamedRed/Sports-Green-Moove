package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.SupportSubmission
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.Properties

internal interface SupportSubmissionStore {
    fun read(uid: String): SupportSubmission?
    fun begin(submission: SupportSubmission): SupportSubmission
    fun acknowledge(uid: String, requestId: String)
}

internal class FileSupportSubmissionStore(private val directory: File) : SupportSubmissionStore {
    private fun path(uid: String): File {
        require(uid.isNotBlank() && uid.length <= 128)
        val key = MessageDigest.getInstance("SHA-256").digest(uid.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        return File(directory, "$key.properties")
    }
    override fun read(uid: String): SupportSubmission? = synchronized(lock) {
        val file = path(uid)
        if (Files.notExists(file.toPath())) return@synchronized null
        val data = Properties().apply { file.inputStream().use { load(it) } }
        check(data.keys == setOf("version", "uid", "requestId", "reason", "description", "emergency", "subjectType", "subjectId"))
        check(data.getProperty("version") == "1" && data.getProperty("uid") == uid)
        val emergency = when (data.getProperty("emergency")) { "true" -> true; "false" -> false; else -> error("Invalid stored support flag") }
        SupportSubmission(uid, data.getProperty("requestId"), data.getProperty("reason"), data.getProperty("description"), emergency,
            data.getProperty("subjectType"), data.getProperty("subjectId").takeUnless { it.isEmpty() }).also { it.validate() }
    }
    override fun begin(submission: SupportSubmission): SupportSubmission = synchronized(lock) {
        submission.validate()
        val existing = read(submission.uid)
        check(existing == null || existing == submission) { "Another support request awaits confirmation" }
        if (existing != null) return@synchronized existing
        Files.createDirectories(directory.toPath())
        val temp = Files.createTempFile(directory.toPath(), "pending-", ".properties")
        try {
            val data = Properties().apply {
                setProperty("version", "1"); setProperty("uid", submission.uid); setProperty("requestId", submission.requestId)
                setProperty("reason", submission.reason); setProperty("description", submission.description)
                setProperty("emergency", submission.emergency.toString()); setProperty("subjectType", submission.subjectType)
                setProperty("subjectId", submission.subjectId.orEmpty())
            }
            FileOutputStream(temp.toFile()).use { data.store(it, null); it.fd.sync() }
            Files.move(temp, path(submission.uid).toPath(), StandardCopyOption.ATOMIC_MOVE)
        } finally { Files.deleteIfExists(temp) }
        submission
    }
    override fun acknowledge(uid: String, requestId: String) = synchronized(lock) {
        if (read(uid)?.requestId == requestId) Files.delete(path(uid).toPath())
        Unit
    }
    private companion object { val lock = Any() }
}
