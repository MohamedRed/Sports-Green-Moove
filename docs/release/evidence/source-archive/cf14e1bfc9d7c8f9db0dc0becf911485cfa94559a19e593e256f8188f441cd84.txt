package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.services.*
import org.junit.Assert.*
import org.junit.Test
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.StandardTestDispatcher

class AppSessionShutdownTest {
    private fun shutdown(failing: String?) = runTest {
        val order = mutableListOf<String>()
        fun stop(name: String) { order += name; if (failing == name) error("Synthetic shutdown failure") }
        val providers = AndroidProviderSet(
            auth = object : AuthGateway by UnconfiguredAuthGateway() {
                override suspend fun prepareSignOut(): SessionExitResult { stop("prepare"); return SessionExitResult.Confirmed }
                override fun signOut() = stop("auth")
            },
            firebase = UnconfiguredFirebaseGateway(),
            googleAuth = object : GoogleSocialAuthGateway by UnconfiguredGoogleSocialAuthGateway() {
                override fun signOut() = stop("google")
            },
            facebookAuth = object : FacebookSocialAuthGateway by UnconfiguredFacebookSocialAuthGateway() {
                override fun signOut() = stop("facebook")
            },
        )
        val result = runCatching { signOutProviders(providers, StandardTestDispatcher(testScheduler)) }
        assertEquals(listOf("prepare", "google", "facebook", "auth"), order)
        assertEquals(failing != null, result.isFailure)
        if (failing == null) assertEquals(SessionExitResult.Confirmed, result.getOrThrow())
    }
    @Test fun allProvidersSignOutInOrder() = shutdown(null)
    @Test fun googleFailureCannotSkipAuthAndDeviceTrackingRevocation() = shutdown("google")
    @Test fun facebookFailureCannotSkipAuthAndDeviceTrackingRevocation() = shutdown("facebook")
    @Test fun authShutdownFailureIsNotReportedAsSuccess() = shutdown("auth")
    @Test fun preparationFailureCannotSkipLocalShutdown() = shutdown("prepare")
}
