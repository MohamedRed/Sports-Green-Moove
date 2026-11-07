package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.TripChangeDraftRecord

internal interface TripChangeDraftStorage {
    fun read(uid: String, tripId: String): TripChangeDraftRecord?
    fun write(uid: String, tripId: String, record: TripChangeDraftRecord?)
}
