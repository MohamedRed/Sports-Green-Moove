package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.services.AndroidProviderSet

internal fun signOutProviders(providers: AndroidProviderSet) {
    try { providers.googleAuth.signOut() }
    finally {
        try { providers.facebookAuth.signOut() }
        finally { providers.auth.signOut() }
    }
}
