package be.sportgreenmoove.app.ui

import androidx.test.platform.app.InstrumentationRegistry
import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.services.ConversationDraftRecord
import be.sportgreenmoove.app.services.SharedPreferencesConversationDrafts
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class ConversationDraftPersistenceTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test fun aNewStorageAndControllerRestoreTheSamePrivateUnsentText() {
        val uid = "draft-test-${UUID.randomUUID()}"
        val ref = ConversationRef(ConversationKind.Booking, "draft-${UUID.randomUUID()}")
        val storage = SharedPreferencesConversationDrafts(context)
        try {
            val first = ConversationDraftState(uid, ref, storage).also { it.load() }
            requireNotNull(first.composer).edit("brouillon prive qa avant fermeture")
            val second = ConversationDraftState(uid, ref, SharedPreferencesConversationDrafts(context)).also { it.load() }
            assertEquals("brouillon prive qa avant fermeture", second.composer?.draft)
            assertNull(second.composer?.pendingId); assertFalse(requireNotNull(second.composer).sending)
            for ((otherUid, otherRef) in listOf("other-$uid" to ref,
                uid to ConversationRef(ConversationKind.RideSession, ref.sourceId),
                uid to ConversationRef(ConversationKind.Booking, "other-${ref.sourceId}"))) {
                assertNull(storage.read(otherUid, otherRef))
            }
        } finally { storage.write(uid, ref, null) }
    }
    @Test fun aPendingIdentitySurvivesARealPreferencesRoundTripAndClearsOnlyItsOwnRecord() {
        val uid = "draft-test-${UUID.randomUUID()}"
        val ref = ConversationRef(ConversationKind.Booking, "draft-${UUID.randomUUID()}")
        val other = ConversationRef(ConversationKind.Booking, "other-${ref.sourceId}")
        val storage = SharedPreferencesConversationDrafts(context)
        val record = ConversationDraftRecord("Unconfirmed", UUID.randomUUID().toString())
        try {
            storage.write(uid, ref, record); storage.write(uid, other, ConversationDraftRecord("Other private text", null))
            val reopened = SharedPreferencesConversationDrafts(context)
            assertEquals(record, reopened.read(uid, ref)); reopened.write(uid, ref, null)
            assertNull(storage.read(uid, ref)); assertEquals("Other private text", storage.read(uid, other)?.body)
        } finally { storage.write(uid, ref, null); storage.write(uid, other, null) }
    }
    @Test fun corruptedOrForeignStoredMetadataFailsClosedWithoutOverwritingIt() {
        val uid = "draft-test-${UUID.randomUUID()}"
        val ref = ConversationRef(ConversationKind.Booking, "draft-${UUID.randomUUID()}")
        val preferences = context.getSharedPreferences("private-conversation-drafts", 0)
        val key = JSONArray(listOf(uid, ref.kind.sourceType, ref.sourceId)).toString()
        try {
            for (raw in listOf("not-json", JSONObject().put("version", 1).put("uid", "other")
                .put("sourceType", "booking").put("sourceId", ref.sourceId).put("body", "Private")
                .put("requestId", JSONObject.NULL).toString())) {
                check(preferences.edit().putString(key, raw).commit())
                val state = ConversationDraftState(uid, ref, SharedPreferencesConversationDrafts(context)).also { it.load() }
                assertNull(state.composer); assertNotNull(state.error); assertEquals(raw, preferences.getString(key, null))
            }
        } finally { check(preferences.edit().remove(key).commit()) }
    }
}
