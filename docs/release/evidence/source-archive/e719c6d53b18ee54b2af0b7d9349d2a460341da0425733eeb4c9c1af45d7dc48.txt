package be.sportgreenmoove.app.services

import java.io.StringReader
import java.io.StringWriter
import java.util.Properties

internal object TeamPushRecordCodec {
    private val keys = setOf("version", "installationId", "proof", "revision", "ownerUid", "epoch", "needsTokenDeletion",
        "pendingKind", "pendingUid", "pendingRevision", "pendingEpoch", "pendingToken", "confirmedUid", "confirmedRevision", "confirmedEpoch", "confirmedTokenHash")
    fun encode(record: TeamPushRecord): String {
        record.validate()
        val pending = record.pending; val confirmed = record.confirmed
        val values = mapOf("version" to "1", "installationId" to record.identity.id, "proof" to record.identity.proof,
            "revision" to record.revision.toString(), "ownerUid" to record.ownerUid.orEmpty(), "epoch" to record.epoch.toString(),
            "needsTokenDeletion" to record.needsTokenDeletion.toString(),
            "pendingKind" to when { pending == null -> "none"; pending.token == null -> "remove"; else -> "active" },
            "pendingUid" to pending?.uid.orEmpty(), "pendingRevision" to (pending?.revision ?: 0).toString(),
            "pendingEpoch" to (pending?.epoch ?: 0).toString(), "pendingToken" to pending?.token.orEmpty(),
            "confirmedUid" to confirmed?.uid.orEmpty(), "confirmedRevision" to (confirmed?.revision ?: 0).toString(),
            "confirmedEpoch" to (confirmed?.epoch ?: 0).toString(), "confirmedTokenHash" to confirmed?.tokenHash.orEmpty())
        return StringWriter().also { writer -> Properties().apply { putAll(values) }.store(writer, null) }.toString()
    }
    fun decode(raw: String): TeamPushRecord {
        try { return decodeRecord(raw) }
        catch (_: IllegalArgumentException) { error("Invalid private phone registration") }
        catch (_: IllegalStateException) { error("Invalid private phone registration") }
    }
    private fun decodeRecord(raw: String): TeamPushRecord {
        check(raw.length in 1..32_768)
        val values = object : Properties() {
            override fun put(key: Any, value: Any): Any? {
                check(!containsKey(key)); return super.put(key, value)
            }
        }.apply { StringReader(raw).use { load(it) } }; check(values.keys == keys)
        fun text(key: String) = values.getProperty(key) ?: error("Invalid private phone registration")
        fun number(key: String): Long = text(key).let { check(it.matches(Regex("0|[1-9][0-9]{0,15}"))); it.toLong() }
        check(text("version") == "1")
        val identity = TeamPushIdentity(text("installationId"), text("proof"))
        val pending = when (text("pendingKind")) {
            "none" -> { check(text("pendingUid").isEmpty() && number("pendingRevision") == 0L && number("pendingEpoch") == 0L && text("pendingToken").isEmpty()); null }
            "remove", "active" -> TeamPushCommand(identity, text("pendingUid"), number("pendingEpoch"), number("pendingRevision"),
                if (text("pendingKind") == "remove") { check(text("pendingToken").isEmpty()); null } else text("pendingToken"))
            else -> error("Invalid private phone request kind")
        }
        val confirmed = if (text("confirmedUid").isEmpty()) {
            check(number("confirmedRevision") == 0L && number("confirmedEpoch") == 0L && text("confirmedTokenHash").isEmpty()); null
        } else TeamPushConfirmed(text("confirmedUid"), number("confirmedEpoch"), number("confirmedRevision"), text("confirmedTokenHash"))
        val deletion = when (text("needsTokenDeletion")) { "true" -> true; "false" -> false; else -> error("Invalid private phone removal state") }
        return TeamPushRecord(identity, number("revision"), text("ownerUid").takeIf(String::isNotEmpty), number("epoch"), deletion, pending, confirmed).also { it.validate() }
    }
}
