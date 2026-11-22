package be.sportgreenmoove.app.data

import java.time.LocalDate
import java.time.LocalTime

internal data class TripChangePlaceInput(val input: String, val point: MapPoint?, val address: String?)

internal data class TripChangeDraftInput(
    val departureDate: LocalDate, val departureTime: LocalTime,
    val arrivalDate: LocalDate, val arrivalTime: LocalTime, val hasArrival: Boolean, val price: String,
    val origin: TripChangePlaceInput, val destination: TripChangePlaceInput,
)

internal data class TripChangeDraftRecord(
    val revision: String, val original: TripChangeTerms, val input: TripChangeDraftInput,
    val pendingProposal: TripChangeProposalRequest?,
)
