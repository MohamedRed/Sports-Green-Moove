package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ActiveRideResumeActionTest {
    private val ride = LiveRideSnapshot("qa-ride", "qa-trip", "qa-driver", "Actif", "", null, "", false)
    private fun providers(write: suspend () -> Unit) = AndroidProviderSet(
        auth = object : AuthGateway by UnconfiguredAuthGateway() {
            override suspend fun currentSession() = AuthSession("qa-driver", null, "QA", setOf(AppRole.Driver))
        },
        firebase = object : FirebaseGateway by UnconfiguredFirebaseGateway() {
            override suspend fun getActiveRide() = ride
            override suspend fun writeNativeLocationFallback(rideSessionId: String, role: AppRole) = write()
        },
    )
    @Test fun anExplicitResumeClearsThePreviousFailureBeforeAcquiringAnotherPoint() = runTest {
        val completed = CompletableDeferred<Unit>(); var error: String? = "Previous failure"; var screen: AppScreen? = null
        launchActiveRideResume(backgroundScope, providers { completed.await() }, AppRole.Driver, ride,
            ActiveRidePermissionGate { it() }, { "qa-driver" }, { assertEquals(ride, it) }, { screen = it }, { error = it })
        runCurrent(); assertNull(error); assertNull(screen)
        completed.complete(Unit); runCurrent(); assertNull(error); assertEquals(AppScreen.Ride, screen)
    }
    @Test fun aNewFailureRemainsVisibleAndDoesNotOpenTheRide() = runTest {
        var error: String? = "Previous failure"; var opened = false
        launchActiveRideResume(backgroundScope, providers { throw ProviderConfigurationException("Position non confirmée.") },
            AppRole.Driver, ride, ActiveRidePermissionGate { it() }, { "qa-driver" }, {}, { opened = true }, { error = it })
        runCurrent(); assertNotNull(error); assertNotEquals("Previous failure", error); assertFalse(opened)
    }
    @Test fun aChangedAccountCannotClearTheNewAccountsErrorOrStartTheOldRide() = runTest {
        var uid = "qa-driver"; var error: String? = "New account message"; var writes = 0
        launchActiveRideResume(backgroundScope, providers { writes++ }, AppRole.Driver, ride,
            ActiveRidePermissionGate { uid = "qa-parent"; it() }, { uid }, {}, {}, { error = it })
        runCurrent(); assertEquals("New account message", error); assertEquals(0, writes)
    }
}
