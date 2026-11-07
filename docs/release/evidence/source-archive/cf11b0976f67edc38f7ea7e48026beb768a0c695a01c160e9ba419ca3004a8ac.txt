package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.RewardSummary

@Composable
fun RewardsRoute(
    summary: RewardSummary,
    availableRoles: Set<AppRole>,
    onBack: () -> Unit,
    onOpenPayments: (AppRole) -> Unit,
    setError: (String) -> Unit,
) {
    RewardsScreen(
        summary = summary,
        onBack = onBack,
        onWithdraw = {
            if (AppRole.Driver in availableRoles) {
                onOpenPayments(AppRole.Driver)
            } else {
                setError("Le retrait des gains nécessite un profil conducteur validé.")
            }
        },
    )
}
