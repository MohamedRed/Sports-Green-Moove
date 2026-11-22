package be.sportgreenmoove.app.services

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID

internal const val teamPushMaximumRevision = 9_007_199_254_740_990L
internal fun teamPushUid(value: String): String = value.also {
    require(it.isNotBlank() && it.length <= 128 && '/' !in it && it !in setOf(".", "..") &&
        !it.matches(Regex("__.*__")) && it.none(Char::isISOControl))
}
internal fun teamPushToken(value: String): String = value.also { require(it.length in 32..4096 && it.matches(Regex("[A-Za-z0-9_:.-]+"))) }
internal fun teamPushHash(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

internal data class TeamPushIdentity(val id: String, val proof: String) {
    fun validate() {
        require(UUID.fromString(id).toString() == id)
        require(proof.matches(Regex("[a-f0-9]{64}")))
    }
    override fun toString() = "TeamPushIdentity(redacted)"
    companion object {
        fun create() = TeamPushIdentity(UUID.randomUUID().toString(), ByteArray(32).also { SecureRandom().nextBytes(it) }
            .joinToString("") { "%02x".format(it) })
    }
}
internal data class TeamPushTicket(val uid: String, val epoch: Long, val revision: Long)
internal data class TeamPushCommand(val identity: TeamPushIdentity, val uid: String, val epoch: Long, val revision: Long, val token: String?) {
    fun validate() {
        identity.validate(); teamPushUid(uid)
        require(epoch in 1..revision && revision in 1..teamPushMaximumRevision)
        token?.let(::teamPushToken)
    }
    fun payload(): Map<String, Any?> {
        validate()
        return mapOf("installationId" to identity.id, "installationSecret" to identity.proof,
            "revision" to revision, "platform" to "android", "token" to token)
    }
    override fun toString() = "TeamPushCommand(revision=$revision, active=${token != null}, private fields redacted)"
}
internal data class TeamPushReceipt(val uid: String, val revision: Long, val active: Boolean, val reused: Boolean)
internal data class TeamPushConfirmed(val uid: String, val epoch: Long, val revision: Long, val tokenHash: String)
internal data class TeamPushRecord(val identity: TeamPushIdentity, val revision: Long = 0, val ownerUid: String? = null,
    val epoch: Long = 0, val needsTokenDeletion: Boolean = false, val pending: TeamPushCommand? = null, val confirmed: TeamPushConfirmed? = null) {
    fun validate() {
        identity.validate(); ownerUid?.let(::teamPushUid)
        require(revision in 0..teamPushMaximumRevision && epoch in 0..revision)
        require(epoch > 0 || ownerUid == null && pending == null && confirmed == null)
        pending?.let {
            it.validate(); require(it.identity == identity && it.revision <= revision && it.epoch <= epoch)
            require(it.token == null || !needsTokenDeletion && it.uid == ownerUid && it.epoch == epoch && it.revision == revision)
        }
        confirmed?.let {
            teamPushUid(it.uid)
            require(!needsTokenDeletion && pending == null && it.uid == ownerUid && it.epoch == epoch)
            require(it.revision == revision && it.revision > 0 && it.tokenHash.matches(Regex("[a-f0-9]{64}")))
        }
    }
    override fun toString() = "TeamPushRecord(revision=$revision, private fields redacted)"
}
