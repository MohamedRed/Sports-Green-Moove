package be.sportgreenmoove.app.services

import android.content.Context
import be.sportgreenmoove.app.data.TripChangeDraftRecord

internal class SharedPreferencesTripChangeDrafts(context: Context) : TripChangeDraftStorage {
    private val preferences = context.applicationContext.getSharedPreferences("private-trip-change-drafts", Context.MODE_PRIVATE)
    override fun read(uid: String, tripId: String): TripChangeDraftRecord? =
        preferences.getString(TripChangeDraftCodec.key(uid, tripId), null)?.let { TripChangeDraftCodec.decode(uid, tripId, it) }

    override fun write(uid: String, tripId: String, record: TripChangeDraftRecord?) {
        val key = TripChangeDraftCodec.key(uid, tripId)
        val edit = preferences.edit()
        if (record == null) edit.remove(key) else edit.putString(key, TripChangeDraftCodec.encode(uid, tripId, record))
        check(edit.commit()) { "Cannot preserve private trip draft" }
    }
}
