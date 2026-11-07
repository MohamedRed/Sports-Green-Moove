package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ConversationBookingOption
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.ConversationGateway
import kotlinx.coroutines.CancellationException

internal class ConversationBookingState(private val gateway: ConversationGateway) {
    var items by mutableStateOf(emptyList<ConversationBookingOption>())
        private set
    var loading by mutableStateOf(true)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var loadingEarlier by mutableStateOf(false)
        private set
    var earlierError by mutableStateOf<String?>(null)
        private set
    var hasEarlier by mutableStateOf(false)
        private set
    private var cursor: String? = null
    private var generation = 0

    suspend fun reload() {
        generation += 1
        loading = true
        error = null
        try {
            val page = gateway.loadBookingOptions()
            items = page.items
            cursor = page.nextCursor
            hasEarlier = cursor != null
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { error = UserFacingErrorPolicy.messageFor(failure) }
        finally { loading = false }
    }

    suspend fun loadEarlier() {
        val before = cursor ?: return
        val requestedGeneration = generation
        if (loadingEarlier) return
        loadingEarlier = true
        earlierError = null
        try {
            val page = gateway.loadBookingOptions(before)
            if (requestedGeneration != generation) return
            items = (items + page.items).associateBy { it.ref.key }.values.toList()
            cursor = page.nextCursor
            hasEarlier = cursor != null
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: Exception) { earlierError = UserFacingErrorPolicy.messageFor(failure) }
        finally { loadingEarlier = false }
    }
}
