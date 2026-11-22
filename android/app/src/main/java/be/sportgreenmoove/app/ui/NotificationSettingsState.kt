package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.services.NotificationSettingsResult

internal class NotificationSettingsState(
    private val readAllowed: () -> Boolean,
    private val launchSettings: () -> NotificationSettingsResult,
) {
    var allowed by mutableStateOf(readAllowed()); private set
    var error by mutableStateOf<String?>(null); private set

    fun refresh() {
        allowed = readAllowed()
        error = null
    }

    fun open() {
        error = when (launchSettings()) {
            NotificationSettingsResult.Opened -> null
            NotificationSettingsResult.Unavailable -> "Les réglages de notifications sont indisponibles sur ce téléphone."
            NotificationSettingsResult.Denied -> "Impossible d’ouvrir les réglages de notifications."
        }
    }
}
