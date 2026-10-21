package be.sportgreenmoove.app.services

import android.content.Context
import be.sportgreenmoove.app.data.TeamConversationTarget
import org.json.JSONArray
import org.json.JSONObject

internal class SharedPreferencesTeamConversationDrafts(context: Context) : TeamConversationDraftStorage {
    private val preferences = context.applicationContext.getSharedPreferences("private-team-conversation-drafts", Context.MODE_PRIVATE)
    private fun key(uid: String, target: TeamConversationTarget): String {
        require(uid.isNotBlank() && uid.length <= 256 && '/' !in uid)
        return JSONArray(listOf(uid, target.teamId, target.teamInstanceId)).toString()
    }
    override fun read(uid: String, target: TeamConversationTarget): TeamConversationDraftRecord? {
        val raw = preferences.getString(key(uid, target), null) ?: return null
        check(raw.length <= 131_072)
        val json = JSONObject(raw)
        check(json.keys().asSequence().toSet() == setOf("version", "uid", "teamId", "teamInstanceId", "body", "requestId"))
        check(json.get("version") == 1 && json.get("uid") == uid)
        check(json.get("teamId") == target.teamId && json.get("teamInstanceId") == target.teamInstanceId)
        return TeamConversationDraftRecord(json.get("body") as String,
            json.get("requestId").takeIf { it != JSONObject.NULL }?.let { it as String })
    }
    override fun write(uid: String, target: TeamConversationTarget, record: TeamConversationDraftRecord?) {
        val edit = preferences.edit(); val name = key(uid, target)
        if (record == null) edit.remove(name) else edit.putString(name, JSONObject().put("version", 1).put("uid", uid)
            .put("teamId", target.teamId).put("teamInstanceId", target.teamInstanceId).put("body", record.body)
            .put("requestId", record.requestId ?: JSONObject.NULL).toString())
        check(edit.commit()) { "Cannot preserve private team draft" }
    }
}
