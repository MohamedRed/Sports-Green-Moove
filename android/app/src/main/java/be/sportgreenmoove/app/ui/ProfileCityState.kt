package be.sportgreenmoove.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ProfileCity
import be.sportgreenmoove.app.data.ProfileCityChange
import be.sportgreenmoove.app.data.normalizedProfileCity
import be.sportgreenmoove.app.services.ProfileCityGateway
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.util.UUID

internal class ProfileCityState(private val uid: String, private val gateway: ProfileCityGateway) {
    var view by mutableStateOf<ProfileCity?>(null); private set
    var input by mutableStateOf(""); private set
    var busy by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var pending by mutableStateOf<ProfileCityChange?>(null); private set
    private var closed = false
    val candidate get() = normalizedProfileCity(input)
    val dirty get() = input != (view?.city ?: "")
    val canSave get() = !closed && !busy && view != null &&
        (pending != null || candidate != null && candidate != view?.city)
    fun edit(value: String) {
        if (!closed && !busy && pending == null && view != null && value.length <= 100) { input = value; error = null }
    }
    fun discard() { if (!busy && pending == null && view != null) { input = view?.city ?: ""; error = null } }
    fun close() { closed = true; view = null; input = ""; pending = null; error = null; busy = false }
    suspend fun refresh() {
        if (closed || busy) return
        busy = true; error = null; view = null; input = ""
        try {
            val result = gateway.readProfileCity(uid)
            currentCoroutineContext().ensureActive()
            if (!closed) { check(result.userId == uid); view = result; input = result.city ?: ""; pending = null }
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { if (!closed) error = "Impossible de charger la ville. Réessayez." }
        finally { if (!closed) busy = false }
    }
    suspend fun save(remove: Boolean = false): Boolean {
        if (closed || busy || view == null) return false
        val change = pending ?: run {
            val city = if (remove) null else candidate ?: return false
            if (city == view?.city) return false
            ProfileCityChange(city, requireNotNull(view).revision, UUID.randomUUID().toString())
        }
        pending = change; busy = true; error = null
        try {
            val result = gateway.saveProfileCity(uid, change)
            currentCoroutineContext().ensureActive()
            if (closed) return false
            check(result.userId == uid && result.revision == change.expectedRevision + 1 && result.city == change.city)
            view = result; input = result.city ?: ""; pending = null
            return true
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) {
            if (!closed) error = "Enregistrement non confirmé. Réessayez ou actualisez la ville."
            return false
        } finally { if (!closed) busy = false }
    }
}
