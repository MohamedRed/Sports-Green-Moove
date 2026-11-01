package be.sportgreenmoove.app.services

import kotlinx.coroutines.CancellationException

internal interface TeamPushStorage {
    fun read(): TeamPushRecord?
    fun update(change: (TeamPushRecord?) -> TeamPushRecord): TeamPushRecord
}

internal class TeamPushJournal(private val storage: TeamPushStorage, private val newIdentity: () -> TeamPushIdentity = TeamPushIdentity::create) {
    private fun change(block: (TeamPushRecord) -> TeamPushRecord) = storage.update { old ->
        val current = old ?: TeamPushRecord(newIdentity())
        current.validate(); block(current).also { it.validate() }
    }
    private fun next(value: Long): Long { check(value < teamPushMaximumRevision); return value + 1 }
    fun current(): TeamPushRecord = storage.read()?.also { it.validate() } ?: change { it }

    fun selectOwner(uid: String?): TeamPushRecord {
        uid?.let(::teamPushUid)
        return change { old -> if (old.ownerUid == uid) old else old.copy(revision = next(old.revision), epoch = next(old.epoch),
            ownerUid = uid, pending = old.pending?.takeIf { it.token == null }, confirmed = null,
            needsTokenDeletion = old.needsTokenDeletion || old.ownerUid != null) }
    }
    fun deletionTicket(): TeamPushTicket = current().let { check(it.needsTokenDeletion); TeamPushTicket(it.ownerUid.orEmpty(), it.epoch, it.revision) }
    fun confirmTokenDeletion(ticket: TeamPushTicket) = change { old ->
        if (old.epoch != ticket.epoch || old.revision != ticket.revision || old.ownerUid.orEmpty() != ticket.uid)
            throw CancellationException("Team phone account changed during token removal")
        check(old.needsTokenDeletion); old.copy(needsTokenDeletion = false)
    }
    fun reserveToken(uid: String): TeamPushTicket {
        val record = change { old ->
            check(old.ownerUid == uid && !old.needsTokenDeletion)
            old.copy(revision = next(old.revision), pending = null, confirmed = null)
        }
        return TeamPushTicket(uid, record.epoch, record.revision)
    }
    fun completeToken(ticket: TeamPushTicket, token: String): TeamPushCommand {
        teamPushToken(token)
        val record = change { old ->
            if (old.ownerUid != ticket.uid || old.epoch != ticket.epoch || old.revision != ticket.revision)
                throw CancellationException("Team phone account changed during token retrieval")
            check(!old.needsTokenDeletion)
            val command = TeamPushCommand(old.identity, ticket.uid, ticket.epoch, ticket.revision, token)
            if (old.confirmed != null || old.pending != null && old.pending != command)
                throw CancellationException("Team phone token retrieval was already consumed")
            old.copy(pending = command)
        }
        return requireNotNull(record.pending)
    }
    fun remove(uid: String): TeamPushCommand {
        val record = change { old ->
            check(old.ownerUid == uid)
            old.copy(revision = next(old.revision), confirmed = null, needsTokenDeletion = true,
                pending = TeamPushCommand(old.identity, uid, old.epoch, next(old.revision), null))
        }
        return requireNotNull(record.pending)
    }
    fun pendingFor(uid: String): TeamPushCommand? = current().pending?.also {
        if (it.uid != uid) throw CancellationException("Pending team phone request belongs to another account")
    }
    fun acknowledge(command: TeamPushCommand, receipt: TeamPushReceipt) = change { old ->
        check(receipt.uid == command.uid && receipt.revision == command.revision && receipt.active == (command.token != null))
        if (old.pending != command) throw CancellationException("Team phone request has been superseded")
        if (command.token != null && (old.ownerUid != command.uid || old.epoch != command.epoch))
            throw CancellationException("Team phone account changed before confirmation")
        old.copy(pending = null, confirmed = command.token?.let {
            check(!old.needsTokenDeletion)
            TeamPushConfirmed(command.uid, command.epoch, command.revision, teamPushHash(it))
        })
    }
    fun confirmedFor(uid: String): Boolean = current().let {
        !it.needsTokenDeletion && it.ownerUid == uid && it.confirmed?.uid == uid && it.pending == null
    }
}
