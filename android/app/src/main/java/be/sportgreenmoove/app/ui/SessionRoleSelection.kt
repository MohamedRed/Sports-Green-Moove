package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole

private val preferredMobileRoleOrder = listOf(
    AppRole.Driver,
    AppRole.ClubManager,
    AppRole.Admin,
    AppRole.Parent,
    AppRole.Child,
)

fun Set<AppRole>.preferredMobileRole(): AppRole =
    preferredMobileRoleOrder.firstOrNull { it in this } ?: AppRole.Parent

fun selectActiveMobileRole(
    currentRole: AppRole,
    availableRoles: Set<AppRole>,
    sessionChanged: Boolean,
): AppRole =
    if (sessionChanged || currentRole !in availableRoles) {
        availableRoles.preferredMobileRole()
    } else {
        currentRole
    }
