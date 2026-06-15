package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.domain.UserFacingErrorPolicy
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

fun launchClubMembershipRequest(
    scope: CoroutineScope,
    providers: AndroidProviderSet,
    club: ClubSummary,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    setNotice: (String) -> Unit,
    refreshAppData: suspend () -> Unit,
) {
    scope.launch {
        setLoading(true)
        setError(null)
        runCatching {
            providers.firebase.requestClubMembership(club.id)
            setNotice("Demande envoyée à ${club.name}.")
            refreshAppData()
        }.onFailure { setError(UserFacingErrorPolicy.messageFor(it)) }
        setLoading(false)
    }
}
