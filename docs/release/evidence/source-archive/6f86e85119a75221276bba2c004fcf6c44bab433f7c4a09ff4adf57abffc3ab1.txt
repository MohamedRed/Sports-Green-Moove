package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.LiveRideSnapshot
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class ActiveRideResumeTest {
    private var session: AuthSession? = AuthSession("driver", null, "QA", setOf(AppRole.Driver))
    private var ride: LiveRideSnapshot? = LiveRideSnapshot("ride", "trip", "driver", "active", "", null, "", false)
    private var writes = 0
    private var afterRead: () -> Unit = {}
    private var afterWrite: () -> Unit = {}
    private val auth = object : AuthGateway by UnconfiguredAuthGateway() {
        override suspend fun currentSession() = session
    }
    private val firebase = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
        override suspend fun getActiveRide(): LiveRideSnapshot? { afterRead(); return ride }
        override suspend fun writeNativeLocationFallback(rideSessionId: String, role: AppRole) {
            assertEquals("ride", rideSessionId); writes++; afterWrite()
        }
    }
    private val providers = AndroidProviderSet(auth, firebase)
    private suspend fun resume(role: AppRole = AppRole.Driver) = providers.resumeOwnedRideTracking("ride", "driver", role)

    @Test fun ownExistingRideResumesTrackingWithoutCreatingAnotherRide() = runBlocking {
        assertEquals(ride, resume()); assertEquals(1, writes)
    }
    @Test fun aParentCannotResumeDriverSensors() = runBlocking {
        session = AuthSession("driver", null, "QA", setOf(AppRole.Parent))
        assertTrue(runCatching { resume(AppRole.Parent) }.isFailure); assertEquals(0, writes)
    }
    @Test fun aDifferentAuthenticatedAccountCannotResumeTheOldDriver() = runBlocking {
        session = AuthSession("parent", null, "QA", setOf(AppRole.Driver))
        assertTrue(runCatching { resume() }.isFailure); assertEquals(0, writes)
    }
    @Test fun missingChangedOrForeignRidesCannotStartSensors() = runBlocking {
        for (changed in listOf(null, ride!!.copy(rideSessionId = "other"), ride!!.copy(driverUserId = "other"))) {
            ride = changed; assertTrue(runCatching { resume() }.isFailure)
        }
        assertEquals(0, writes)
    }
    @Test fun anAccountSwitchDuringTheRideReadCannotStartSensors() = runBlocking {
        afterRead = { session = null }; assertTrue(runCatching { resume() }.isFailure); assertEquals(0, writes)
    }
    @Test fun anAccountSwitchDuringTheLocationWriteCannotReturnAStaleRide() = runBlocking {
        afterWrite = { session = null }; assertTrue(runCatching { resume() }.isFailure); assertEquals(1, writes)
    }
}
