package be.sportgreenmoove.app.domain

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.LiveRideSnapshot

fun canManageRide(role: AppRole, session: AuthSession?, ride: LiveRideSnapshot?): Boolean =
    role == AppRole.Driver && session?.roles?.contains(AppRole.Driver) == true &&
        session.uid == ride?.driverUserId
