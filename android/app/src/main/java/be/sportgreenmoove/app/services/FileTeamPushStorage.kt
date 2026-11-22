package be.sportgreenmoove.app.services

import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption

internal class FileTeamPushStorage(private val directory: File) : TeamPushStorage {
    private val path get() = File(directory, "registration.properties")
    override fun read(): TeamPushRecord? = synchronized(lock) {
        if (Files.notExists(path.toPath())) null else TeamPushRecordCodec.decode(path.readText(Charsets.UTF_8))
    }
    override fun update(change: (TeamPushRecord?) -> TeamPushRecord): TeamPushRecord = synchronized(lock) {
        val prior = read(); val next = change(prior).also { it.validate() }
        if (next == prior) return@synchronized next
        Files.createDirectories(directory.toPath())
        val temporary = Files.createTempFile(directory.toPath(), "registration-", ".properties")
        try {
            FileOutputStream(temporary.toFile()).use { it.write(TeamPushRecordCodec.encode(next).toByteArray(Charsets.UTF_8)); it.fd.sync() }
            Files.move(temporary, path.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally { Files.deleteIfExists(temporary) }
        next
    }
    private companion object { val lock = Any() }
}
