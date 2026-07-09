package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.CoroutineScope

@Composable
fun GroupsRoute(
    clubs: List<ClubSummary>,
    scope: CoroutineScope,
    providers: AndroidProviderSet,
    onBack: () -> Unit,
    setLoading: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    setNotice: (String) -> Unit,
    refreshAppData: suspend () -> Unit,
) {
    GroupsScreen(
        clubs = clubs,
        onBack = onBack,
        onJoinClub = { club ->
            launchClubMembershipRequest(
                scope = scope,
                providers = providers,
                club = club,
                setLoading = setLoading,
                setError = setError,
                setNotice = setNotice,
                refreshAppData = refreshAppData,
            )
        },
    )
}
