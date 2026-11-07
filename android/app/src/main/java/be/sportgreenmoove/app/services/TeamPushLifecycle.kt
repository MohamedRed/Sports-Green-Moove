package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TeamConversationTarget
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout

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
    fun requiresSignOut(uid: String?): Boolean = uid != null && journal.current().signOutUid == uid

    // Auth callbacks invalidate durable ownership before queued asynchronous work can finish.
    fun accountChanged(uid: String?) = synchronized(transitions) {
        if (requiresSignOut(uid)) { tokens.setAutoInit(false); return@synchronized journal.selectOwner(null) }
        if (journal.current().ownerUid != uid) tokens.setAutoInit(false)
        journal.selectOwner(uid)
    }

    fun signedOut() = synchronized(transitions) {
        tokens.setAutoInit(false)
        journal.beginSignOut(currentUid())
    }
    fun notificationsDisabled() = synchronized(transitions) {
        tokens.setAutoInit(false)
        val record = journal.current()
        if (record.ownerUid != null && record.ownerUid == currentUid() &&
            (record.confirmed != null || record.pending?.token != null)) journal.remove(record.ownerUid)
    }
    fun authorizeSignIn(uid: String) = synchronized(transitions) {
        check(currentUid() == uid)
        journal.authorizeSignIn(uid)
    }

    suspend fun prepareSignOut(afterIntent: () -> Unit = {}): SessionExitResult {
        val record = signedOut()
        afterIntent()
        val command = record.pending?.takeIf { it.token == null && it.uid == currentUid() }
            ?: return if (record.pending == null) SessionExitResult.NoRegistration else SessionExitResult.Pending
        return try {
            withTimeout(2_500L) {
                if (currentUid() != command.uid) throw CancellationException("Sign-out account changed")
                val receipt = register(command)
                if (currentUid() != command.uid) throw CancellationException("Sign-out account changed")
                journal.acknowledge(command, receipt)
            }
            SessionExitResult.Confirmed
        } catch (_: TimeoutCancellationException) { SessionExitResult.Pending }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { SessionExitResult.Pending }
    }

    suspend fun synchronize(allowed: Boolean, refreshToken: Boolean = false): TeamPushSyncResult = mutex.withLock {
        try {
            val uid = currentUid()
            val signingOut = synchronized(transitions) {
                if (requiresSignOut(uid)) { journal.selectOwner(null); true } else { journal.selectOwner(uid); false }
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
    fun alertRequest(notificationId: String): TeamPushOpenRequest? = synchronized(transitions) {
        teamPushAlertId(notificationId)
        val uid = currentUid() ?: return@synchronized null
        val record = journal.current()
        if (record.ownerUid != uid || record.signOutUid != null || record.needsTokenDeletion) return@synchronized null
        TeamPushOpenRequest(notificationId, uid, record.epoch)
    }
    fun acceptsAlert(request: TeamPushOpenRequest): Boolean = synchronized(transitions) {
        val record = journal.current()
        currentUid() == request.uid && record.ownerUid == request.uid && record.epoch == request.epoch && record.signOutUid == null
    }
    suspend fun resolveAlert(request: TeamPushOpenRequest, purpose: TeamPushAlertPurpose,
        resolve: suspend (TeamPushAlertLease, String, TeamPushAlertPurpose) -> Any?,
        consume: (TeamConversationTarget) -> Unit): Boolean = mutex.withLock {
        val lease = synchronized(transitions) {
            if (!acceptsAlert(request) || !journal.confirmedFor(request.uid)) return@withLock false
            val record = journal.current()
            TeamPushAlertLease(record.identity, request.uid, request.epoch, record.revision)
        }
        val target = parseTeamPushAlert(resolve(lease, request.notificationId, purpose), request.notificationId) ?: return@withLock false
        synchronized(transitions) {
            if (!acceptsAlert(request) || !journal.confirmedFor(request.uid) || journal.current().revision != lease.revision)
                return@withLock false
            consume(target)
        }
        true
    }
    private suspend fun deleteIfRequired() {
        if (!journal.current().needsTokenDeletion) return
        tokens.setAutoInit(false)
        val ticket = journal.deletionTicket()
        tokens.deleteToken()
        journal.confirmTokenDeletion(ticket)
    }
    private fun requireCurrent(uid: String) {
        if (currentUid() != uid || journal.current().ownerUid != uid || requiresSignOut(uid))
            throw CancellationException("Team phone account changed during synchronization")
    }
}

internal fun teamPushAdultClaims(claims: Map<String, Any?>): Boolean {
    val roles = claims["roleKeys"] as? List<*> ?: return false
    return roles.all { it is String } && "child" !in roles && roles.any { it in setOf("parent", "driver", "clubManager") }
}
