package be.sportgreenmoove.app.services

import android.content.Context
import be.sportgreenmoove.app.data.ConversationRef
import org.json.JSONArray
import org.json.JSONObject

internal class SharedPreferencesConversationDrafts(context: Context) : ConversationDraftStorage {
    private val preferences = context.applicationContext.getSharedPreferences("private-conversation-drafts", Context.MODE_PRIVATE)
    private fun key(uid: String, ref: ConversationRef): String {
        require(uid.isNotBlank() && uid.length <= 256 && '/' !in uid)
        return JSONArray(listOf(uid, ref.kind.sourceType, ref.sourceId)).toString()
    }
    override fun read(uid: String, ref: ConversationRef): ConversationDraftRecord? {
        val raw = preferences.getString(key(uid, ref), null) ?: return null
        check(raw.length <= 131_072)
        val json = JSONObject(raw)
        check(json.keys().asSequence().toSet() == setOf("version", "uid", "sourceType", "sourceId", "body", "requestId"))
        check(json.get("version") == 1 && json.get("uid") == uid)
        check(json.get("sourceType") == ref.kind.sourceType && json.get("sourceId") == ref.sourceId)
        return ConversationDraftRecord(json.get("body") as String,
            json.get("requestId").takeIf { it != JSONObject.NULL }?.let { it as String })
    }
    override fun write(uid: String, ref: ConversationRef, record: ConversationDraftRecord?) {
        val edit = preferences.edit(); val name = key(uid, ref)
        if (record == null) edit.remove(name) else edit.putString(name, JSONObject().put("version", 1).put("uid", uid)
            .put("sourceType", ref.kind.sourceType).put("sourceId", ref.sourceId).put("body", record.body)
            .put("requestId", record.requestId ?: JSONObject.NULL).toString())
        check(edit.commit()) { "Cannot preserve private conversation draft" }
    }
}
