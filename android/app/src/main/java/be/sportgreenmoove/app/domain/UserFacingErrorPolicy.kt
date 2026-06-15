package be.sportgreenmoove.app.domain

import java.util.Locale

object UserFacingErrorPolicy {
    fun messageFor(error: Throwable): String {
        val className = error.javaClass.simpleName
        val message = error.message.orEmpty()
        val normalizedMessage = message.lowercase(Locale.ROOT)

        return when {
            isNetworkError(className, normalizedMessage) ->
                "Connexion réseau indisponible. Vérifiez votre connexion puis réessayez."
            normalizedMessage.contains("driver role is required") ->
                "Votre profil conducteur doit être validé avant cette action."
            normalizedMessage.contains("parent role is required") ->
                "Votre profil parent doit être activé avant cette action."
            normalizedMessage.contains("clubmanager role is required") ->
                "Votre profil gestionnaire de club doit être validé avant cette action."
            normalizedMessage.contains("admin role is required") ||
                normalizedMessage.contains("permission_denied") ||
                normalizedMessage.contains("permission-denied") ->
                "Vous n'avez pas les droits nécessaires pour cette action."
            normalizedMessage.contains("driver verification is required") ->
                "La vérification conducteur est requise avant de publier un trajet."
            normalizedMessage.contains("not found") ||
                normalizedMessage.contains("not-found") ->
                "Cet élément n'est plus disponible."
            normalizedMessage.contains("failed_precondition") ||
                normalizedMessage.contains("failed-precondition") ->
                "Cette action n'est pas disponible dans l'état actuel."
            normalizedMessage.contains("invalid_argument") ||
                normalizedMessage.contains("invalid-argument") ->
                "Vérifiez les informations saisies puis réessayez."
            normalizedMessage.contains("unauthenticated") ->
                "Reconnectez-vous pour continuer."
            normalizedMessage.contains("stripe") ||
                normalizedMessage.contains("payment") ->
                "Paiement indisponible pour le moment. Réessayez plus tard."
            normalizedMessage.contains("places") ||
                normalizedMessage.contains("routes") ||
                normalizedMessage.contains("coordonnées place") ->
                "Service cartographique indisponible pour le moment."
            className.contains("ProviderConfigurationException", ignoreCase = true) ->
                message.takeIf { it.isNotBlank() }
                    ?: "Service indisponible. Contactez le support SPORTS GREEN-mOOVe."
            else ->
                "Action impossible pour le moment. Réessayez dans quelques instants."
        }
    }

    private fun isNetworkError(className: String, normalizedMessage: String): Boolean =
        className.contains("Network", ignoreCase = true) ||
            normalizedMessage.contains("network") ||
            normalizedMessage.contains("unavailable") ||
            normalizedMessage.contains("deadline_exceeded") ||
            normalizedMessage.contains("deadline-exceeded") ||
            normalizedMessage.contains("interrupted")
}
