package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot

internal fun emergencyRideSessionId(roles: Set<AppRole>, ride: LiveRideSnapshot?, openedFromRide: Boolean): String? =
    ride?.rideSessionId?.takeIf { AppRole.Child in roles || openedFromRide }
