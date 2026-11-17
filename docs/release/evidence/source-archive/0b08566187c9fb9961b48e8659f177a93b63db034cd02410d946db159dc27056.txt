package be.sportgreenmoove.app.services

internal class TeamPushTestFixture {
    class Memory : TeamPushStorage {
        var value: TeamPushRecord? = null
        var failWrites = false
        override fun read() = value
        override fun update(change: (TeamPushRecord?) -> TeamPushRecord): TeamPushRecord {
            check(!failWrites) { "Synthetic storage failure" }
            return change(value).also { value = it }
        }
    }
    var uid: String? = "parent"
    var adult = true
    var autoInit = false
    var retrieved = 0
    var deleted = 0
    val memory = Memory()
    val token = "synthetic_" + "T".repeat(80)
    val journal = TeamPushJournal(memory)
    val calls = mutableListOf<TeamPushCommand>()
    var tokenAction: suspend () -> String = { token }
    var deleteAction: suspend () -> Unit = {}
    var callAction: suspend (TeamPushCommand) -> TeamPushReceipt = { TeamPushReceipt(it.uid, it.revision, it.token != null, false) }
    val source = object : TeamPushTokenSource {
        override fun setAutoInit(enabled: Boolean) { autoInit = enabled }
        override suspend fun token(): String { retrieved++; return tokenAction() }
        override suspend fun deleteToken() { deleted++; deleteAction() }
    }
    val lifecycle = TeamPushLifecycle(journal, source, { uid }, { adult }) { calls += it; callAction(it) }
    fun account(value: String?) { uid = value; lifecycle.accountChanged(value) }
}
