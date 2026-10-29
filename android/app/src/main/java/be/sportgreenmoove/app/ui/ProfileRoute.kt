package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.data.ClubSummary
import be.sportgreenmoove.app.data.NativeLedgerSummaries
import be.sportgreenmoove.app.services.ProfileCityGateway
import be.sportgreenmoove.app.services.ReceivedRatingsGateway

@Composable
fun ProfileRoute(
    role: AppRole,
    availableRoles: Set<AppRole>,
    session: AuthSession?,
    cityGateway: ProfileCityGateway,
    ratingsGateway: ReceivedRatingsGateway,
    clubs: List<ClubSummary>,
    ledgerSummaries: NativeLedgerSummaries,
    onRoleChange: (AppRole) -> Unit,
    onGroups: () -> Unit,
    onImpact: () -> Unit,
    onRewards: () -> Unit,
    onPayments: () -> Unit,
    onOptions: () -> Unit,
    onLogout: () -> Unit,
) {
    val uid = session?.uid ?: return
    ProfileCityHost(uid, cityGateway) { cityLabel, onCity ->
        ProfileScreen(
            role = role,
            availableRoles = availableRoles,
            displayName = session.displayName,
            email = session.email,
            receivedRatings = { ProfileReceivedRatings(uid, ratingsGateway) },
            cityLabel = cityLabel,
            onCity = onCity,
            primaryClubLabel = clubs.firstOrNull { it.isMember }?.name ?: "Aucun club lié",
            impactSummary = ledgerSummaries.impact,
            rewardSummary = ledgerSummaries.rewards,
            onRoleChange = onRoleChange,
            onGroups = onGroups,
            onImpact = onImpact,
            onRewards = onRewards,
            onPayments = onPayments,
            onOptions = onOptions,
            onLogout = onLogout,
        )
    }
}
