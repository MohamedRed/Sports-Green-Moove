package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.BookingRequestSummary
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.data.RidePassengerStatus
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.StripePaymentSheetController
import be.sportgreenmoove.app.services.endTrackedRide
import be.sportgreenmoove.app.services.startTrackedRide
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import java.util.Locale

fun approvedBookingIdsFor(
    trip: TripSummary,
    requests: List<BookingRequestSummary>,
): List<String> =
    requests
        .filter { it.tripId == trip.id && it.status == "approved" }
        .map { it.bookingId }

fun TripSummary.distanceMetersFromLabel(): Int {
    val km = Regex("""\d+(?:[,.]\d+)?""")
        .find(distanceLabel)
        ?.value
        ?.replace(',', '.')
        ?.toDoubleOrNull()
        ?: return 0
    return (km * 1000).toInt()
}

fun launchPayment(
    scope: CoroutineScope,
    providers: AndroidProviderSet,
    paymentSheet: StripePaymentSheetController,
    booking: PayableBookingSummary,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit,
) {
    scope.launch {
        setLoading(true)
        setError(null)
        runCatching {
            if (!providers.stripe.isConfigured) {
                error("Stripe Android n'est pas configuré.")
            }
            val config = providers.stripe.prepareRidePayment(booking.bookingId)
            paymentSheet.present(config)
        }.onFailure {
            setError(it.message)
        }
        setLoading(false)
    }
}

fun launchApproveBooking(
    scope: CoroutineScope,
    providers: AndroidProviderSet,
    request: BookingRequestSummary,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    setNotice: (String) -> Unit,
    refreshAppData: suspend () -> Unit,
) {
    scope.launch {
        setLoading(true)
        setError(null)
        runCatching {
            providers.firebase.approveBooking(request.bookingId)
            setNotice("Demande approuvée.")
            refreshAppData()
        }.onFailure { setError(it.message) }
        setLoading(false)
    }
}

fun launchTripAction(
    scope: CoroutineScope,
    providers: AndroidProviderSet,
    trip: TripSummary,
    role: be.sportgreenmoove.app.data.AppRole,
    driverBookingRequests: List<BookingRequestSummary>,
    activeRidePermissionGate: ActiveRidePermissionGate,
    setActiveRide: (LiveRideSnapshot) -> Unit,
    setActiveRideTrip: (TripSummary?) -> Unit,
    setNotice: (String) -> Unit,
    setScreen: (DemoScreen) -> Unit,
    setError: (String?) -> Unit,
) {
    val action: () -> Unit = {
        scope.launch {
            runCatching {
                if (role == be.sportgreenmoove.app.data.AppRole.Driver) {
                    val result = providers.startTrackedRide(
                        trip.id,
                        role,
                        approvedBookingIdsFor(trip, driverBookingRequests),
                    )
                    setActiveRide(result.ride)
                    setActiveRideTrip(trip)
                    setNotice(result.notice)
                    setScreen(DemoScreen.Ride)
                } else {
                    val bookingId = providers.firebase.requestBooking(trip.id)
                    setNotice("Demande envoyée: $bookingId")
                }
            }.onFailure { setError(it.message) }
        }
    }

    if (role == be.sportgreenmoove.app.data.AppRole.Driver) {
        activeRidePermissionGate.runWhenReady(action)
    } else {
        action()
    }
}

fun launchPassengerStatusUpdate(
    scope: CoroutineScope,
    providers: AndroidProviderSet,
    ride: LiveRideSnapshot?,
    passenger: RidePassengerStatus,
    pickup: Boolean,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    setNotice: (String) -> Unit,
    setActiveRide: (LiveRideSnapshot?) -> Unit,
) {
    val activeRide = ride ?: return
    scope.launch {
        setLoading(true)
        setError(null)
        runCatching {
            if (pickup) {
                providers.firebase.markPickup(activeRide.rideSessionId, passenger.bookingId, passenger.childId)
                setNotice("Pickup confirmé.")
            } else {
                providers.firebase.markDropoff(activeRide.rideSessionId, passenger.bookingId, passenger.childId)
                setNotice("Dropoff confirmé.")
            }
            setActiveRide(providers.firebase.getActiveRide())
        }.onFailure { setError(it.message) }
        setLoading(false)
    }
}

fun launchEndActiveRide(
    scope: CoroutineScope,
    providers: AndroidProviderSet,
    ride: LiveRideSnapshot?,
    activeRideTrip: TripSummary?,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    setNotice: (String) -> Unit,
    setActiveRide: (LiveRideSnapshot?) -> Unit,
    setActiveRideTrip: (TripSummary?) -> Unit,
    setScreen: (DemoScreen) -> Unit,
    refreshAppData: suspend () -> Unit,
) {
    val activeRide = ride ?: return
    scope.launch {
        setLoading(true)
        setError(null)
        runCatching {
            val completion = providers.endTrackedRide(
                rideSessionId = activeRide.rideSessionId,
                distanceMeters = activeRideTrip?.distanceMetersFromLabel() ?: 0,
                passengersSharing = activeRide.passengers.size.coerceAtLeast(1),
            )
            setActiveRide(null)
            setActiveRideTrip(null)
            setScreen(DemoScreen.Trips)
            setNotice("Course terminée · ${"%.1f".format(Locale.FRANCE, completion.co2SavedKg)} kg CO₂ · ${completion.rewardLabel()}")
            refreshAppData()
        }.onFailure { setError(it.message) }
        setLoading(false)
    }
}

private fun be.sportgreenmoove.app.data.RideCompletionSummary.rewardLabel(): String {
    val euros = rewardCents / 100
    val cents = (rewardCents % 100).toString().padStart(2, '0')
    return "$euros,$cents €"
}
