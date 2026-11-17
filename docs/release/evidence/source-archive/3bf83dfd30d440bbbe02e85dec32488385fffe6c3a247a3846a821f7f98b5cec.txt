package be.sportgreenmoove.app.services

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

internal interface TeamPushTokenSource {
    fun setAutoInit(enabled: Boolean)
    suspend fun token(): String
    suspend fun deleteToken()
}
internal enum class TeamPushSyncResult { Inactive, Registered }

internal class TeamPushLifecycle(
    private val journal: TeamPushJournal,
    private val tokens: TeamPushTokenSource,
    private val currentUid: () -> String?,
    private val eligible: suspend (String) -> Boolean,
    private val register: suspend (TeamPushCommand) -> TeamPushReceipt,
) {
    private val mutex = Mutex()
    private val transitions = Any()
    @Volatile private var signingOutUid: String? = null

    // Auth callbacks invalidate durable ownership before queued asynchronous work can finish.
    fun accountChanged(uid: String?) = synchronized(transitions) {
        if (uid != null && uid == signingOutUid) return@synchronized journal.current()
        if (uid != signingOutUid) signingOutUid = null
        if (journal.current().ownerUid != uid) tokens.setAutoInit(false)
        journal.selectOwner(uid)
    }

    fun signedOut() = synchronized(transitions) {
        signingOutUid = currentUid()
        tokens.setAutoInit(false)
        val owner = journal.current().ownerUid
        if (owner != null) journal.remove(owner)
        journal.selectOwner(null)
    }

    suspend fun synchronize(allowed: Boolean, refreshToken: Boolean = false): TeamPushSyncResult = mutex.withLock {
        try {
            val uid = currentUid()
            val signingOut = synchronized(transitions) {
                if (uid != null && uid == signingOutUid) true else { journal.selectOwner(uid); false }
            }
            tokens.setAutoInit(false)
            if (uid == null || signingOut) { deleteIfRequired(); return@withLock TeamPushSyncResult.Inactive }
            val canRegister = allowed && eligible(uid); requireCurrent(uid)
            if (!canRegister) {
                val record = journal.current()
                if (record.confirmed != null || record.pending?.token != null) journal.remove(uid)
                try { flushPending(uid) } finally { deleteIfRequired() }
                return@withLock TeamPushSyncResult.Inactive
            }
            val record = journal.current()
            if (record.pending?.token == null) {
                try { flushPending(uid) } finally { deleteIfRequired() }
            } else flushPending(uid)
            val ticket = synchronized(transitions) {
                requireCurrent(uid)
                tokens.setAutoInit(true)
                if (!refreshToken && journal.confirmedFor(uid)) return@withLock TeamPushSyncResult.Registered
                journal.reserveToken(uid)
            }
            val token = tokens.token(); requireCurrent(uid)
            val command = journal.completeToken(ticket, token)
            val receipt = register(command); requireCurrent(uid)
            synchronized(transitions) { requireCurrent(uid); journal.acknowledge(command, receipt) }
            TeamPushSyncResult.Registered
        } catch (failure: Exception) {
            tokens.setAutoInit(false)
            throw failure
        }
    }

    private suspend fun flushPending(uid: String) {
        val command = journal.current().pending?.takeIf { it.uid == uid } ?: return
        requireCurrent(uid); val receipt = register(command); requireCurrent(uid)
        journal.acknowledge(command, receipt)
    }
    private suspend fun deleteIfRequired() {
        if (!journal.current().needsTokenDeletion) return
        tokens.setAutoInit(false)
        val ticket = journal.deletionTicket()
        tokens.deleteToken()
        journal.confirmTokenDeletion(ticket)
    }
    private fun requireCurrent(uid: String) {
        if (currentUid() != uid || journal.current().ownerUid != uid || uid == signingOutUid)
            throw CancellationException("Team phone account changed during synchronization")
    }
}

internal fun teamPushAdultClaims(claims: Map<String, Any?>): Boolean {
    val roles = claims["roleKeys"] as? List<*> ?: return false
    return roles.all { it is String } && "child" !in roles && roles.any { it in setOf("parent", "driver", "clubManager") }
}
