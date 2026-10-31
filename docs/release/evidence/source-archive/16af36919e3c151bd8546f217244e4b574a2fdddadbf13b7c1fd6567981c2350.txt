package be.sportgreenmoove.app.services

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import kotlinx.coroutines.CancellationException
import java.net.URI

data class StripeConnectOwner(val uid: String, val email: String?, val role: AppRole)

class StripeConnectCoordinator(
    private val gateway: StripePaymentsGateway,
    private val currentOwner: () -> StripeConnectOwner?,
    private val blocked: () -> Boolean,
    private val error: (String?) -> Unit,
    private val notice: (String?) -> Unit,
) {
    var busy by mutableStateOf(false)
        private set

    suspend fun start(urls: StripeConnectUrls?, openUrl: (String) -> Unit) {
        if (busy || blocked()) return
        val owner = currentOwner()
        if (owner == null || owner.uid.isBlank()) { error("Reconnectez-vous pour continuer."); return }
        if (owner.role != AppRole.Driver) { error("Cette action est réservée au conducteur."); return }
        val email = owner.email?.trim()?.takeIf(String::isNotBlank)
        if (email == null) { error("Ajoutez une adresse e-mail à votre compte pour continuer."); return }
        if (!gateway.isConfigured || urls == null || !secureUrl(urls.returnUrl) || !secureUrl(urls.refreshUrl)) {
            error(unavailableMessage); return
        }
        busy = true
        error(null); notice(null)
        try {
            gateway.createStripeAccount(email)
            if (currentOwner() != owner) return
            val link = gateway.createStripeAccountLink(urls.returnUrl, urls.refreshUrl)
            if (currentOwner() != owner) return
            if (!secureUrl(link.url)) { error(unavailableMessage); return }
            openUrl(link.url)
            notice("Poursuivez l’inscription dans votre navigateur.")
        } catch (failure: CancellationException) {
            throw failure
        } catch (failure: Exception) {
            if (currentOwner() == owner) error(if (failure is ProviderConfigurationException) unavailableMessage
                else UserFacingErrorPolicy.messageFor(failure))
        } finally { busy = false }
    }

    private fun secureUrl(value: String): Boolean = try {
        val uri = URI(value)
        uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.rawUserInfo == null
    } catch (_: Exception) { false }

    companion object {
        const val unavailableMessage = "L’inscription conducteur est indisponible pour le moment. Contactez le support."
    }
}
