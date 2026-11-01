package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.services.AndroidProviderSet
import be.sportgreenmoove.app.services.SessionExitResult
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers

internal suspend fun signOutProviders(providers: AndroidProviderSet, preparationDispatcher: CoroutineDispatcher = Dispatchers.IO): SessionExitResult {
    try { return withContext(preparationDispatcher) { withTimeout(3_000L) { providers.auth.prepareSignOut() } } }
    finally {
        withContext(NonCancellable) {
            try { providers.googleAuth.signOut() }
            finally {
                try { providers.facebookAuth.signOut() }
                finally { providers.auth.signOut() }
            }
        }
    }
}
