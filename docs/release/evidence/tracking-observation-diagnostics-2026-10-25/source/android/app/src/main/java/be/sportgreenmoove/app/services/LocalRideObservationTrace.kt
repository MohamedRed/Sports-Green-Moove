package be.sportgreenmoove.app.services

import android.os.SystemClock
import android.util.Log
import be.sportgreenmoove.app.BuildConfig

internal fun localRideObservationTrace(): RideObservationTrace? =
    if (BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR && BuildConfig.SGM_LOCAL_RIDE_TRACE) {
        RideObservationTrace(SystemClock::elapsedRealtime) { Log.i("SGM.RideObservation", it) }
    } else null
