package be.sportgreenmoove.app.services

import android.app.Activity
import be.sportgreenmoove.app.data.AuthSession

interface GoogleSocialAuthGateway {
    val isConfigured: Boolean
    suspend fun signIn(activity: Activity): AuthSession
    fun signOut()
}

class UnconfiguredGoogleSocialAuthGateway : GoogleSocialAuthGateway {
    override val isConfigured: Boolean = false

    override suspend fun signIn(activity: Activity): AuthSession {
        check(!activity.isFinishing)
        throw ProviderConfigurationException("Google Auth Android n'est pas configuré.")
    }

    override fun signOut() = Unit
}
