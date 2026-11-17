package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.domain.BelgianTripZone
import be.sportgreenmoove.app.domain.sameTripChangeInstant
import be.sportgreenmoove.app.domain.tripChangeInstant
import be.sportgreenmoove.app.domain.tripChangePriceCents
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale

internal class TripChangeDraft(private val initial: TripChangeTerms, restored: TripChangeDraftInput? = null, private val onChange: () -> Unit = {}) {
    private val departure = Instant.parse(initial.departureAt).atZone(BelgianTripZone)
    private val arrival = initial.arrivalBy?.let { Instant.parse(it).atZone(BelgianTripZone) }
    private var departureDateValue by mutableStateOf(restored?.departureDate ?: departure.toLocalDate())
    private var departureTimeValue by mutableStateOf(restored?.departureTime ?: departure.toLocalTime())
    private var arrivalDateValue by mutableStateOf(restored?.arrivalDate ?: arrival?.toLocalDate() ?: departure.toLocalDate())
    private var arrivalTimeValue by mutableStateOf(restored?.arrivalTime ?: arrival?.toLocalTime() ?: departure.toLocalTime())
    private var hasArrivalValue by mutableStateOf(restored?.hasArrival ?: (arrival != null))
    private var priceValue by mutableStateOf(restored?.price ?: String.format(Locale.ROOT, "%.2f", initial.priceCents / 100.0).replace('.', ','))
    var departureDate: LocalDate get() = departureDateValue; set(value) { departureDateValue = value; onChange() }
    var departureTime: LocalTime get() = departureTimeValue; set(value) { departureTimeValue = value; onChange() }
    var arrivalDate: LocalDate get() = arrivalDateValue; set(value) { arrivalDateValue = value; onChange() }
    var arrivalTime: LocalTime get() = arrivalTimeValue; set(value) { arrivalTimeValue = value; onChange() }
    var hasArrival: Boolean get() = hasArrivalValue; set(value) { hasArrivalValue = value; onChange() }
    var price: String get() = priceValue; set(value) { priceValue = value; onChange() }
    val origin = TripChangePlaceDraft(initial.origin, restored?.origin, onChange)
    val destination = TripChangePlaceDraft(initial.destination, restored?.destination, onChange)

    fun snapshot() = TripChangeDraftInput(departureDate, departureTime, arrivalDate, arrivalTime, hasArrival, price, origin.snapshot(), destination.snapshot())

    private fun departureValue(): String? = if (departureDate == departure.toLocalDate() && departureTime == departure.toLocalTime()) initial.departureAt
        else tripChangeInstant(departureDate, departureTime)
    private fun arrivalValue(): String? = if (!hasArrival) null else if (arrival != null && arrivalDate == arrival.toLocalDate() && arrivalTime == arrival.toLocalTime()) initial.arrivalBy
        else tripChangeInstant(arrivalDate, arrivalTime)

    fun validationMessage(now: Instant): String? {
        val departure = departureValue() ?: return "Cette heure de départ est ambiguë ou inexistante à Bruxelles."
        val arrival = arrivalValue()
        if (hasArrival && arrival == null) return "Cette heure d’arrivée est ambiguë ou inexistante à Bruxelles."
        if (!Instant.parse(departure).isAfter(now)) return "Le départ doit être dans le futur."
        if (arrival != null && Instant.parse(arrival).isBefore(Instant.parse(departure))) return "L’arrivée ne peut pas précéder le départ."
        if (tripChangePriceCents(price) == null) return "Le prix doit être compris entre 0 et 1 000 EUR, avec deux décimales maximum."
        if (origin.point == null && !origin.busy) return "L’adresse de départ n’est pas encore confirmée."
        if (destination.point == null && !destination.busy) return "L’adresse d’arrivée n’est pas encore confirmée."
        return null
    }

    fun terms(now: Instant): TripChangeTerms? {
        val departure = departureValue() ?: return null
        val arrival = arrivalValue()
        if (hasArrival && arrival == null) return null
        if (!Instant.parse(departure).isAfter(now) || (arrival != null && Instant.parse(arrival).isBefore(Instant.parse(departure)))) return null
        return TripChangeTerms(departure, arrival, origin.point ?: return null, destination.point ?: return null,
            tripChangePriceCents(price) ?: return null)
    }

    fun changedFrom(initial: TripChangeTerms, now: Instant): Boolean = terms(now)?.let { next ->
        !sameTripChangeInstant(next.departureAt, initial.departureAt) || !sameTripChangeInstant(next.arrivalBy, initial.arrivalBy) ||
            next.origin != initial.origin || next.destination != initial.destination || next.priceCents != initial.priceCents
    } == true
}

internal class TripChangePlaceDraft(private val initial: MapPoint, restored: TripChangePlaceInput? = null, private val onChange: () -> Unit = {}) {
    var input by mutableStateOf(restored?.input ?: ""); private set
    var point by mutableStateOf<MapPoint?>(if (restored == null) initial else restored.point); private set
    var address by mutableStateOf(restored?.address); private set
    var suggestions by mutableStateOf<List<PlaceSuggestion>>(emptyList()); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    private var generation = 0L
    private var closed = false

    fun edit(value: String) {
        if (closed || value == input) return
        generation++; input = value; point = null; address = null; suggestions = emptyList(); error = null; busy = false
        onChange()
    }
    fun keepOriginal() {
        if (closed) return
        generation++; input = ""; point = initial; address = null; suggestions = emptyList(); error = null; busy = false
        onChange()
    }
    suspend fun suggest(gateway: be.sportgreenmoove.app.services.FirebaseGateway) {
        if (closed || input.isBlank() || busy) return
        val ticket = ++generation; busy = true; error = null
        try {
            val found = gateway.suggestPlaces(input.trim())
            if (!closed && generation == ticket) suggestions = found
        } catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
        catch (_: Exception) { if (!closed && generation == ticket) error = "Recherche d’adresse indisponible." }
        finally { if (!closed && generation == ticket) busy = false }
    }
    suspend fun select(suggestion: PlaceSuggestion, gateway: be.sportgreenmoove.app.services.FirebaseGateway) {
        if (closed || busy || suggestion !in suggestions) return
        val ticket = ++generation; busy = true; error = null
        try {
            val place = gateway.resolvePlace(suggestion.placeId)
            if (!closed && generation == ticket) {
                check(place.placeId == suggestion.placeId && place.lat.isFinite() && place.lng.isFinite() &&
                    place.lat in -90.0..90.0 && place.lng in -180.0..180.0)
                input = place.label; address = place.formattedAddress; point = MapPoint(place.lat, place.lng); suggestions = emptyList()
                onChange()
            }
        } catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
        catch (_: Exception) { if (!closed && generation == ticket) error = "Adresse non confirmée. Relancez la recherche." }
        finally { if (!closed && generation == ticket) busy = false }
    }
    fun snapshot() = TripChangePlaceInput(input, point, address)
    fun close() { closed = true; generation++; input = ""; point = null; address = null; suggestions = emptyList(); error = null; busy = false }
}
